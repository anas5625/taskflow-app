const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users — list all users (admin only, for assignment)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY name'
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/dashboard — personal dashboard stats
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Total projects
    const projectsQuery = isAdmin
      ? 'SELECT COUNT(*) FROM projects'
      : 'SELECT COUNT(*) FROM project_members WHERE user_id = $1';
    const projectsResult = await pool.query(projectsQuery, isAdmin ? [] : [userId]);

    // Task stats
    const taskStatsQuery = isAdmin
      ? `SELECT status, COUNT(*) as count FROM tasks GROUP BY status`
      : `SELECT t.status, COUNT(*) as count FROM tasks t
         JOIN project_members pm ON t.project_id = pm.project_id
         WHERE pm.user_id = $1 GROUP BY t.status`;
    const taskStats = await pool.query(taskStatsQuery, isAdmin ? [] : [userId]);

    // Overdue tasks
    const overdueQuery = isAdmin
      ? `SELECT COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'done'`
      : `SELECT COUNT(*) FROM tasks t
         JOIN project_members pm ON t.project_id = pm.project_id
         WHERE pm.user_id = $1 AND t.due_date < NOW() AND t.status != 'done'`;
    const overdueResult = await pool.query(overdueQuery, isAdmin ? [] : [userId]);

    // My assigned tasks (recent)
    const myTasksResult = await pool.query(
      `SELECT t.*, p.name as project_name, a.name as assignee_name,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as is_overdue
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.assignee_id = $1 AND t.status != 'done'
       ORDER BY t.due_date ASC NULLS LAST LIMIT 10`,
      [userId]
    );

    // Recent activity (recent tasks across accessible projects)
    const recentQuery = isAdmin
      ? `SELECT t.*, p.name as project_name, u.name as assignee_name
         FROM tasks t JOIN projects p ON t.project_id = p.id
         LEFT JOIN users u ON t.assignee_id = u.id
         ORDER BY t.updated_at DESC LIMIT 5`
      : `SELECT t.*, p.name as project_name, u.name as assignee_name
         FROM tasks t JOIN projects p ON t.project_id = p.id
         JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
         LEFT JOIN users u ON t.assignee_id = u.id
         ORDER BY t.updated_at DESC LIMIT 5`;
    const recentResult = await pool.query(recentQuery, isAdmin ? [] : [userId]);

    const statusMap = {};
    taskStats.rows.forEach(row => { statusMap[row.status] = parseInt(row.count); });

    res.json({
      stats: {
        total_projects: parseInt(projectsResult.rows[0].count),
        total_tasks: Object.values(statusMap).reduce((a, b) => a + b, 0),
        todo: statusMap['todo'] || 0,
        in_progress: statusMap['in_progress'] || 0,
        review: statusMap['review'] || 0,
        done: statusMap['done'] || 0,
        overdue: parseInt(overdueResult.rows[0].count),
      },
      my_tasks: myTasksResult.rows,
      recent_activity: recentResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
