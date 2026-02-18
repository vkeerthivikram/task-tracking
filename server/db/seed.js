const db = require('./database');

function seedDatabase() {
  // Check if data already exists
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (projectCount.count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // Sample projects
  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, color) VALUES (?, ?, ?)
  `);

  const projects = [
    { name: 'Website Redesign', description: 'Complete overhaul of the company website with modern design', color: '#3B82F6' },
    { name: 'Mobile App Development', description: 'Build cross-platform mobile application', color: '#10B981' },
    { name: 'API Integration', description: 'Integrate third-party APIs for payment and notifications', color: '#8B5CF6' }
  ];

  projects.forEach(p => insertProject.run(p.name, p.description, p.color));

  // Sample tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, start_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tasks = [
    // Project 1 tasks
    { projectId: 1, title: 'Design homepage mockup', description: 'Create wireframes and high-fidelity mockups for the new homepage', status: 'done', priority: 'high', dueDate: '2024-02-10', startDate: '2024-02-01' },
    { projectId: 1, title: 'Implement responsive navigation', description: 'Build mobile-first navigation component', status: 'in_progress', priority: 'high', dueDate: '2024-02-15', startDate: '2024-02-10' },
    { projectId: 1, title: 'Create contact form', description: 'Design and implement the contact form with validation', status: 'todo', priority: 'medium', dueDate: '2024-02-20', startDate: null },
    { projectId: 1, title: 'Optimize images', description: 'Compress and optimize all images for web', status: 'backlog', priority: 'low', dueDate: null, startDate: null },

    // Project 2 tasks
    { projectId: 2, title: 'Set up React Native project', description: 'Initialize the project with Expo and configure build tools', status: 'done', priority: 'urgent', dueDate: '2024-02-05', startDate: '2024-02-01' },
    { projectId: 2, title: 'Implement user authentication', description: 'Add login, registration, and password reset functionality', status: 'review', priority: 'high', dueDate: '2024-02-18', startDate: '2024-02-10' },
    { projectId: 2, title: 'Design onboarding flow', description: 'Create the onboarding screens for new users', status: 'in_progress', priority: 'medium', dueDate: '2024-02-22', startDate: '2024-02-15' },
    { projectId: 2, title: 'Push notifications setup', description: 'Configure push notification service', status: 'todo', priority: 'medium', dueDate: '2024-02-25', startDate: null },

    // Project 3 tasks
    { projectId: 3, title: 'Stripe integration', description: 'Implement Stripe payment gateway', status: 'in_progress', priority: 'urgent', dueDate: '2024-02-12', startDate: '2024-02-08' },
    { projectId: 3, title: 'SendGrid email setup', description: 'Configure transactional emails via SendGrid', status: 'todo', priority: 'high', dueDate: '2024-02-14', startDate: null },
    { projectId: 3, title: 'Twilio SMS integration', description: 'Add SMS notifications for critical alerts', status: 'backlog', priority: 'medium', dueDate: null, startDate: null },
    { projectId: 3, title: 'API documentation', description: 'Write comprehensive API documentation', status: 'review', priority: 'low', dueDate: '2024-02-28', startDate: '2024-02-20' }
  ];

  tasks.forEach(t => insertTask.run(
    t.projectId, 
    t.title, 
    t.description, 
    t.status, 
    t.priority, 
    t.dueDate, 
    t.startDate
  ));

  console.log('Database seeded successfully with sample data');
}

module.exports = { seedDatabase };
