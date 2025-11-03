import bcrypt from 'bcryptjs';
import { storage } from './storage';

async function createTestUser() {
  try {
    // Check if demo user already exists
    const existingUser = await storage.getUserByUsername('demo_user');
    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    const demoUser = await storage.createUser({
      id: 'demo_user_001',
      username: 'demo_user',
      email: 'demo@segnaluce.it',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      provider: 'local',
      providerId: 'demo_user',
    });

    console.log('Demo user created successfully:', demoUser.username);
  } catch (error) {
    console.error('Error creating demo user:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser().then(() => process.exit(0));
}

export { createTestUser };