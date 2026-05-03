const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const { status, priority, assignee } = req.query;
    let conditions = ['t.project_id = $1'];
    let params = [req.params.projectId];
    let idx = 2;

    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
    if (assignee) { conditions.push(`t.assignee_id = $${idx++}`); params.push(assignee); }

    const result = await pool.query(
      `SELECT t.*, 
        a.name as assignee_name, a.email as assignee_email,
        c.name as created_by_name,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as is_overdue
       FROM tasks t
       LEFT JOIN users a ON t.assignee_id = a.id
       JOIN users c ON t.created_by = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY 
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.due_date ASC NULLS LAST,
         t.created_at DESC`,
      params
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/tasks
router.post(
  '/',
  authenticate,
  requireProjectAccess,
  [
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('due_date').optional().isISO8601().withMessage('Invalid date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, status, priority, assignee_id, due_date } = req.body;

      // Validate assignee is a project member
      if (assignee_id) {
        const memberCheck = await pool.query(
          'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
          [req.params.projectId, assignee_id]
        );
        if (memberCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Assignee must be a project member.' });
        }
      }

      const result = await pool.query(
        `INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title, description, status || 'todo', priority || 'medium',
         req.params.projectId, assignee_id || null, req.user.id, due_date || null]
      );

      res.status(201).json({ task: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const taskResult = await pool.query(
      `SELECT t.*, a.name as assignee_name, c.name as created_by_name,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as is_overdue
       FROM tasks t
       LEFT JOIN users a ON t.assignee_id = a.id
       JOIN users c ON t.created_by = c.id
       WHERE t.id = $1 AND t.project_id = $2`,
      [req.params.id, req.params.projectId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const commentsResult = await pool.query(
      `SELECT tc.*, u.name as user_name FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1 ORDER BY tc.created_at ASC`,
      [req.params.id]
    );

    res.json({ task: taskResult.rows[0], comments: commentsResult.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/tasks/:id
router.put('/:id', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const { title, description, status, priority, assignee_id, due_date } = req.body;

    const existing = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.id, req.params.projectId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Members can only update tasks assigned to them (status only)
    const isAdminOrCreator =
      req.user.role === 'admin' ||
      req.projectRole === 'admin' ||
      existing.rows[0].created_by === req.user.id;

    const result = await pool.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        assignee_id = COALESCE($5, assignee_id),
        due_date = COALESCE($6, due_date)
       WHERE id = $7 AND project_id = $8 RETURNING *`,
      [
        isAdminOrCreator ? title : null,
        isAdminOrCreator ? description : null,
        status,
        isAdminOrCreator ? priority : null,
        isAdminOrCreator ? assignee_id : null,
        isAdminOrCreator ? due_date : null,
        req.params.id,
        req.params.projectId,
      ]
    );

    res.json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const task = await pool.query(
      'SELECT created_by FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.id, req.params.projectId]
    );
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const canDelete =
      req.user.role === 'admin' ||
      req.projectRole === 'admin' ||
      task.rows[0].created_by === req.user.id;

    if (!canDelete) return res.status(403).json({ error: 'Not authorized to delete this task.' });

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/tasks/:id/comments
router.post('/:id/comments', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required.' });

    const result = await pool.query(
      'INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, req.user.id, content.trim()]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
