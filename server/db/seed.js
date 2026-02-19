const db = require('./database');
const crypto = require('crypto');

function seedDatabase() {
  // Check if data already exists
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (projectCount.count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // First, insert people (needed for project owner_id references)
  const insertPerson = db.prepare(`
    INSERT INTO people (id, name, email, company, designation, project_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const people = [
    { id: crypto.randomUUID(), name: 'Alice Johnson', email: 'alice@techcorp.com', company: 'TechCorp', designation: 'Project Manager', projectId: null },
    { id: crypto.randomUUID(), name: 'Bob Smith', email: 'bob@designstudio.com', company: 'Design Studio', designation: 'Senior Designer', projectId: null },
    { id: crypto.randomUUID(), name: 'Carol Williams', email: 'carol@devagency.com', company: 'Dev Agency', designation: 'Full Stack Developer', projectId: null },
    { id: crypto.randomUUID(), name: 'David Brown', email: 'david@techcorp.com', company: 'TechCorp', designation: 'Backend Developer', projectId: null },
    { id: crypto.randomUUID(), name: 'Eve Martinez', email: 'eve@freelance.com', company: 'Freelance', designation: 'QA Engineer', projectId: null }
  ];

  const peopleIds = [];
  people.forEach(p => {
    insertPerson.run(p.id, p.name, p.email, p.company, p.designation, p.projectId);
    peopleIds.push(p.id);
  });

  // Sample projects (including nested projects with owners - v1.3.0)
  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, color, parent_project_id, owner_id) VALUES (?, ?, ?, ?, ?)
  `);

  const projects = [
    // Root projects with owners
    { name: 'Website Redesign', description: 'Complete overhaul of the company website with modern design', color: '#3B82F6', parentId: null, ownerId: peopleIds[0] },
    { name: 'Mobile App Development', description: 'Build cross-platform mobile application', color: '#10B981', parentId: null, ownerId: peopleIds[2] },
    { name: 'API Integration', description: 'Integrate third-party APIs for payment and notifications', color: '#8B5CF6', parentId: null, ownerId: peopleIds[3] },
    // Sub-projects for Website Redesign (id: 1)
    { name: 'Frontend Development', description: 'React components and UI implementation', color: '#60A5FA', parentId: 1, ownerId: peopleIds[1] },
    { name: 'Backend Services', description: 'API and database layer for the website', color: '#34D399', parentId: 1, ownerId: peopleIds[3] },
    // Sub-projects for Mobile App Development (id: 2)
    { name: 'iOS App', description: 'Native iOS application', color: '#A78BFA', parentId: 2, ownerId: peopleIds[2] },
    { name: 'Android App', description: 'Native Android application', color: '#F472B6', parentId: 2, ownerId: peopleIds[2] }
  ];

  const projectIds = [];
  projects.forEach(p => {
    const result = insertProject.run(p.name, p.description, p.color, p.parentId, p.ownerId);
    projectIds.push(result.lastInsertRowid);
  });

  // Sample people (using UUID for TEXT primary key)
  const insertPersonAgain = db.prepare(`
    INSERT INTO people (id, name, email, company, designation, project_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const peopleAgain = [
    { id: crypto.randomUUID(), name: 'Alice Johnson', email: 'alice@techcorp.com', company: 'TechCorp', designation: 'Project Manager', projectId: projectIds[0] },
    { id: crypto.randomUUID(), name: 'Bob Smith', email: 'bob@designstudio.com', company: 'Design Studio', designation: 'Senior Designer', projectId: projectIds[0] },
    { id: crypto.randomUUID(), name: 'Carol Williams', email: 'carol@devagency.com', company: 'Dev Agency', designation: 'Full Stack Developer', projectId: projectIds[1] },
    { id: crypto.randomUUID(), name: 'David Brown', email: 'david@techcorp.com', company: 'TechCorp', designation: 'Backend Developer', projectId: projectIds[2] },
    { id: crypto.randomUUID(), name: 'Eve Martinez', email: 'eve@freelance.com', company: 'Freelance', designation: 'QA Engineer', projectId: null }
  ];

  const peopleAgainIds = [];
  peopleAgain.forEach(p => {
    insertPersonAgain.run(p.id, p.name, p.email, p.company, p.designation, p.projectId);
    peopleAgainIds.push(p.id);
  });

  // Sample tags (some global, some project-specific)
  const insertTag = db.prepare(`
    INSERT INTO tags (id, name, color, project_id) 
    VALUES (?, ?, ?, ?)
  `);

  const tags = [
    // Global tags
    { id: crypto.randomUUID(), name: 'Bug', color: '#EF4444', projectId: null },
    { id: crypto.randomUUID(), name: 'Feature', color: '#10B981', projectId: null },
    { id: crypto.randomUUID(), name: 'Enhancement', color: '#3B82F6', projectId: null },
    // Project-specific tags
    { id: crypto.randomUUID(), name: 'UI/UX', color: '#8B5CF6', projectId: projectIds[0] },
    { id: crypto.randomUUID(), name: 'Performance', color: '#F59E0B', projectId: projectIds[1] },
    { id: crypto.randomUUID(), name: 'Security', color: '#DC2626', projectId: projectIds[2] }
  ];

  const tagIds = [];
  tags.forEach(t => {
    insertTag.run(t.id, t.name, t.color, t.projectId);
    tagIds.push(t.id);
  });

  // Sample tasks (including nested tasks with progress tracking)
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, start_date, assignee_id, parent_task_id, progress_percent, estimated_duration_minutes, actual_duration_minutes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tasks = [
    // Project 1 tasks (Website Redesign) - Parent task
    { projectId: projectIds[0], title: 'Design homepage mockup', description: 'Create wireframes and high-fidelity mockups for the new homepage', status: 'done', priority: 'high', dueDate: '2024-02-10', startDate: '2024-02-01', assigneeId: peopleAgainIds[1], parentId: null, progress: 100, estimated: 480, actual: 520 },
    
    // Sub-tasks for Design homepage mockup
    { projectId: projectIds[0], title: 'Create wireframes', description: 'Low-fidelity wireframes for all page sections', status: 'done', priority: 'high', dueDate: '2024-02-05', startDate: '2024-02-01', assigneeId: peopleAgainIds[1], parentId: 1, progress: 100, estimated: 120, actual: 100 },
    { projectId: projectIds[0], title: 'Design high-fidelity mockups', description: 'Figma designs with all visual elements', status: 'done', priority: 'high', dueDate: '2024-02-08', startDate: '2024-02-05', assigneeId: peopleAgainIds[1], parentId: 1, progress: 100, estimated: 240, actual: 280 },
    { projectId: projectIds[0], title: 'Get stakeholder approval', description: 'Present designs and get sign-off', status: 'done', priority: 'medium', dueDate: '2024-02-10', startDate: '2024-02-08', assigneeId: peopleAgainIds[0], parentId: 1, progress: 100, estimated: 120, actual: 140 },
    
    // More Project 1 tasks
    { projectId: projectIds[0], title: 'Implement responsive navigation', description: 'Build mobile-first navigation component', status: 'in_progress', priority: 'high', dueDate: '2024-02-15', startDate: '2024-02-10', assigneeId: peopleAgainIds[1], parentId: null, progress: 60, estimated: 360, actual: 240 },
    { projectId: projectIds[0], title: 'Create contact form', description: 'Design and implement the contact form with validation', status: 'todo', priority: 'medium', dueDate: '2024-02-20', startDate: null, assigneeId: null, parentId: null, progress: 0, estimated: 240, actual: null },
    { projectId: projectIds[0], title: 'Optimize images', description: 'Compress and optimize all images for web', status: 'backlog', priority: 'low', dueDate: null, startDate: null, assigneeId: null, parentId: null, progress: 0, estimated: 180, actual: null },

    // Project 2 tasks (Mobile App Development) - Parent task with sub-tasks
    { projectId: projectIds[1], title: 'Set up React Native project', description: 'Initialize the project with Expo and configure build tools', status: 'done', priority: 'urgent', dueDate: '2024-02-05', startDate: '2024-02-01', assigneeId: peopleAgainIds[2], parentId: null, progress: 100, estimated: 240, actual: 200 },
    { projectId: projectIds[1], title: 'Implement user authentication', description: 'Add login, registration, and password reset functionality', status: 'review', priority: 'high', dueDate: '2024-02-18', startDate: '2024-02-10', assigneeId: peopleAgainIds[2], parentId: null, progress: 85, estimated: 600, actual: 540 },
    
    // Sub-tasks for user authentication
    { projectId: projectIds[1], title: 'Login screen', description: 'Build login UI and form validation', status: 'done', priority: 'high', dueDate: '2024-02-12', startDate: '2024-02-10', assigneeId: peopleAgainIds[2], parentId: 9, progress: 100, estimated: 180, actual: 160 },
    { projectId: projectIds[1], title: 'Registration flow', description: 'Implement user registration with email verification', status: 'done', priority: 'high', dueDate: '2024-02-14', startDate: '2024-02-12', assigneeId: peopleAgainIds[2], parentId: 9, progress: 100, estimated: 240, actual: 220 },
    { projectId: projectIds[1], title: 'Password reset', description: 'Forgot password functionality', status: 'in_progress', priority: 'medium', dueDate: '2024-02-16', startDate: '2024-02-14', assigneeId: peopleAgainIds[2], parentId: 9, progress: 70, estimated: 180, actual: 160 },
    
    // More Project 2 tasks
    { projectId: projectIds[1], title: 'Design onboarding flow', description: 'Create the onboarding screens for new users', status: 'in_progress', priority: 'medium', dueDate: '2024-02-22', startDate: '2024-02-15', assigneeId: peopleAgainIds[2], parentId: null, progress: 40, estimated: 300, actual: 120 },
    { projectId: projectIds[1], title: 'Push notifications setup', description: 'Configure push notification service', status: 'todo', priority: 'medium', dueDate: '2024-02-25', startDate: null, assigneeId: null, parentId: null, progress: 0, estimated: 240, actual: null },

    // Project 3 tasks (API Integration)
    { projectId: projectIds[2], title: 'Stripe integration', description: 'Implement Stripe payment gateway', status: 'in_progress', priority: 'urgent', dueDate: '2024-02-12', startDate: '2024-02-08', assigneeId: peopleAgainIds[3], parentId: null, progress: 75, estimated: 480, actual: 360 },
    { projectId: projectIds[2], title: 'SendGrid email setup', description: 'Configure transactional emails via SendGrid', status: 'todo', priority: 'high', dueDate: '2024-02-14', startDate: null, assigneeId: peopleAgainIds[3], parentId: null, progress: 0, estimated: 180, actual: null },
    { projectId: projectIds[2], title: 'Twilio SMS integration', description: 'Add SMS notifications for critical alerts', status: 'backlog', priority: 'medium', dueDate: null, startDate: null, assigneeId: null, parentId: null, progress: 0, estimated: 240, actual: null },
    { projectId: projectIds[2], title: 'API documentation', description: 'Write comprehensive API documentation', status: 'review', priority: 'low', dueDate: '2024-02-28', startDate: '2024-02-20', assigneeId: peopleAgainIds[0], parentId: null, progress: 90, estimated: 360, actual: 400 }
  ];

  const taskIds = [];
  tasks.forEach(t => {
    const result = insertTask.run(
      t.projectId, 
      t.title, 
      t.description, 
      t.status, 
      t.priority, 
      t.dueDate, 
      t.startDate,
      t.assigneeId,
      t.parentId,
      t.progress,
      t.estimated,
      t.actual
    );
    taskIds.push(result.lastInsertRowid);
  });

  // Sample task_assignees (co-assignees/collaborators)
  const insertTaskAssignee = db.prepare(`
    INSERT INTO task_assignees (id, task_id, person_id, role) 
    VALUES (?, ?, ?, ?)
  `);

  const taskAssignees = [
    // Alice reviews and collaborates on various tasks
    { taskId: taskIds[0], personId: peopleAgainIds[0], role: 'reviewer' }, // Alice reviews homepage mockup
    { taskId: taskIds[8], personId: peopleAgainIds[0], role: 'collaborator' }, // Alice helps with React Native setup
    { taskId: taskIds[16], personId: peopleAgainIds[2], role: 'collaborator' }, // Carol helps with Stripe integration
    // Eve (QA) tests several tasks
    { taskId: taskIds[4], personId: peopleAgainIds[4], role: 'tester' }, // Eve tests navigation
    { taskId: taskIds[9], personId: peopleAgainIds[4], role: 'tester' }, // Eve tests authentication
    { taskId: taskIds[17], personId: peopleAgainIds[4], role: 'tester' }, // Eve will test SendGrid
  ];

  taskAssignees.forEach(ta => {
    insertTaskAssignee.run(crypto.randomUUID(), ta.taskId, ta.personId, ta.role);
  });

  // Sample task_tags
  const insertTaskTag = db.prepare(`
    INSERT INTO task_tags (id, task_id, tag_id) 
    VALUES (?, ?, ?)
  `);

  const taskTags = [
    // Project 1 tasks
    { taskId: taskIds[0], tagId: tagIds[3] }, // Design homepage -> UI/UX
    { taskId: taskIds[0], tagId: tagIds[1] }, // Design homepage -> Feature
    { taskId: taskIds[4], tagId: tagIds[1] }, // Navigation -> Feature
    { taskId: taskIds[4], tagId: tagIds[3] }, // Navigation -> UI/UX
    { taskId: taskIds[5], tagId: tagIds[1] }, // Contact form -> Feature
    { taskId: taskIds[6], tagId: tagIds[2] }, // Optimize images -> Enhancement
    
    // Project 2 tasks
    { taskId: taskIds[7], tagId: tagIds[1] }, // React Native setup -> Feature
    { taskId: taskIds[8], tagId: tagIds[1] }, // Authentication -> Feature
    { taskId: taskIds[8], tagId: tagIds[5] }, // Authentication -> Security
    { taskId: taskIds[12], tagId: tagIds[3] }, // Onboarding -> UI/UX
    { taskId: taskIds[13], tagId: tagIds[1] }, // Push notifications -> Feature
    { taskId: taskIds[13], tagId: tagIds[4] }, // Push notifications -> Performance
    
    // Project 3 tasks
    { taskId: taskIds[14], tagId: tagIds[1] }, // Stripe -> Feature
    { taskId: taskIds[14], tagId: tagIds[5] }, // Stripe -> Security
    { taskId: taskIds[15], tagId: tagIds[1] }, // SendGrid -> Feature
    { taskId: taskIds[16], tagId: tagIds[2] }, // Twilio -> Enhancement
    { taskId: taskIds[17], tagId: tagIds[2] }, // Documentation -> Enhancement
  ];

  taskTags.forEach(tt => {
    insertTaskTag.run(crypto.randomUUID(), tt.taskId, tt.tagId);
  });

  // Sample project_assignees (v1.3.0 feature)
  const insertProjectAssignee = db.prepare(`
    INSERT INTO project_assignees (id, project_id, person_id, role) 
    VALUES (?, ?, ?, ?)
  `);

  const projectAssignees = [
    // Website Redesign project - Alice is lead (also owner), Bob is member
    { projectId: projectIds[0], personId: peopleIds[0], role: 'lead' },
    { projectId: projectIds[0], personId: peopleIds[1], role: 'member' },
    // Mobile App Development - Carol is lead (also owner), Eve is observer
    { projectId: projectIds[1], personId: peopleIds[2], role: 'lead' },
    { projectId: projectIds[1], personId: peopleIds[4], role: 'observer' },
    // API Integration - David is lead (also owner), Alice is member for oversight
    { projectId: projectIds[2], personId: peopleIds[3], role: 'lead' },
    { projectId: projectIds[2], personId: peopleIds[0], role: 'member' },
    // Frontend Development sub-project - Bob is lead, Alice is observer
    { projectId: projectIds[3], personId: peopleIds[1], role: 'lead' },
    { projectId: projectIds[3], personId: peopleIds[0], role: 'observer' },
    // Backend Services sub-project - David is lead, Carol is member
    { projectId: projectIds[4], personId: peopleIds[3], role: 'lead' },
    { projectId: projectIds[4], personId: peopleIds[2], role: 'member' }
  ];

  projectAssignees.forEach(pa => {
    insertProjectAssignee.run(crypto.randomUUID(), pa.projectId, pa.personId, pa.role);
  });

  // Sample notes (v1.2.0 feature)
  const insertNote = db.prepare(`
    INSERT INTO notes (id, content, entity_type, entity_id) 
    VALUES (?, ?, ?, ?)
  `);

  const notes = [
    // Notes on projects
    { id: crypto.randomUUID(), content: 'Client meeting scheduled for next Monday to review progress. Make sure to have the homepage mockups ready by then.', entityType: 'project', entityId: projectIds[0] },
    { id: crypto.randomUUID(), content: 'Consider using GraphQL for the API layer to reduce over-fetching. Team agreed on this approach.', entityType: 'project', entityId: projectIds[2] },
    { id: crypto.randomUUID(), content: 'Sub-project created to separate frontend and backend work streams. This will help with parallel development.', entityType: 'project', entityId: projectIds[3] },
    
    // Notes on tasks
    { id: crypto.randomUUID(), content: 'Bob did an excellent job on the wireframes. Stakeholders particularly liked the mobile-first approach.', entityType: 'task', entityId: taskIds[1] },
    { id: crypto.randomUUID(), content: 'Authentication is using JWT tokens with 24-hour expiry. Refresh tokens stored securely in Keychain/Keystore.', entityType: 'task', entityId: taskIds[8] },
    { id: crypto.randomUUID(), content: 'Stripe webhook handling is complete. Need to add idempotency keys for duplicate prevention.', entityType: 'task', entityId: taskIds[14] },
    { id: crypto.randomUUID(), content: 'This task depends on the login screen being complete. Started early but may need to wait for UI approval.', entityType: 'task', entityId: taskIds[11] },
    
    // Notes on people
    { id: crypto.randomUUID(), content: 'Alice is the main point of contact for project status updates. Weekly sync on Fridays.', entityType: 'person', entityId: peopleAgainIds[0] },
    { id: crypto.randomUUID(), content: 'Bob has extensive Figma experience - can help with any design-related questions.', entityType: 'person', entityId: peopleAgainIds[1] },
    { id: crypto.randomUUID(), content: 'Eve prefers to be involved early in the development cycle for better test planning.', entityType: 'person', entityId: peopleAgainIds[4] }
  ];

  notes.forEach(n => {
    insertNote.run(n.id, n.content, n.entityType, n.entityId);
  });

  // Summary logging
  const rootProjects = projects.filter(p => p.parentId === null).length;
  const subProjects = projects.filter(p => p.parentId !== null).length;
  const rootTasks = tasks.filter(t => t.parentId === null).length;
  const subTasks = tasks.filter(t => t.parentId !== null).length;
  const projectNotes = notes.filter(n => n.entityType === 'project').length;
  const taskNotes = notes.filter(n => n.entityType === 'task').length;
  const personNotes = notes.filter(n => n.entityType === 'person').length;

  console.log('Database seeded successfully with sample data');
  console.log(`- ${projects.length} projects (${rootProjects} root, ${subProjects} sub-projects)`);
  console.log(`- ${people.length} people`);
  console.log(`- ${tags.length} tags (${tags.filter(t => t.projectId === null).length} global, ${tags.filter(t => t.projectId !== null).length} project-specific)`);
  console.log(`- ${tasks.length} tasks (${rootTasks} root, ${subTasks} sub-tasks)`);
  console.log(`- ${taskAssignees.length} task assignments`);
  console.log(`- ${taskTags.length} task-tag associations`);
  console.log(`- ${projectAssignees.length} project assignments (v1.3.0)`);
  console.log(`- ${notes.length} notes (${projectNotes} on projects, ${taskNotes} on tasks, ${personNotes} on people)`);
}

module.exports = { seedDatabase };
