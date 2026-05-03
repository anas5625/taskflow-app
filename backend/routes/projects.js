const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

// GET /api/projects — list projects accessible to user
router.get('/', authenticate, async (req, res, next) => {
  try {
    let query, params;

    if (req.user.role === 'admin') {
      query = `
        SELECT p.*, u.name as owner_name,
          COUNT(DISTINCT pm.user_id) as member_count,
          COUNT(DISTINCT t.id) as task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, u.name
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT p.*, u.name as owner_name,
          COUNT(DISTINCT pm2.user_id) as member_count,
          COUNT(DISTINCT t.id) as task_count,
          pm1.role as my_role
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        JOIN project_members pm1 ON p.id = pm1.project_id AND pm1.user_id = $1
        LEFT JOIN project_members pm2 ON p.id = pm2.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, u.name, pm1.role
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ projects: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects — create project (admin only)
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create projects.' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description } = req.body;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const projectResult = await client.query(
          'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
          [name, description, req.user.id]
        );
        const project = projectResult.rows[0];

        // Auto-add creator as admin member
        await client.query(
          'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
          [project.id, req.user.id, 'admin']
        );

        await client.query('COMMIT');
        res.status(201).json({ project });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:id — get single project
router.get('/:id', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name FROM projects p
       JOIN users u ON p.owner_id = u.id WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
       FROM project_members pm JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [req.params.id]
    );

    res.json({ project: result.rows[0], members: membersResult.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id — update project
router.put('/:id', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.projectRole !== 'admin') {
      return res.status(403).json({ error: 'Only project admins can update projects.' });
    }

    const { name, description, status } = req.body;
    const result = await pool.query(
      `UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description),
       status = COALESCE($3, status) WHERE id = $4 RETURNING *`,
      [name, description, status, req.params.id]
    );

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — delete project (admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete projects.' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/members — add member to project
router.post('/:id/members', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.projectRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members.' });
    }

    const { userId, role = 'member' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    // Check user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const result = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3 RETURNING *`,
      [req.params.id, userId, role]
    );

    res.status(201).json({ member: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id/members/:userId — remove member
router.delete('/:id/members/:userId', authenticate, requireProjectAccess, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.projectRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members.' });
    }

    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );

    res.json({ message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
