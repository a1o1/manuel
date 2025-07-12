// Mock user context for simulating user-scoped data
// In production, this would come from the auth service

class MockUserContext {
  private currentUserId: string = 'user1';

  getCurrentUserId(): string {
    return this.currentUserId;
  }

  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  // Get user email based on ID (for testing different users)
  getCurrentUserEmail(): string {
    const userEmails: Record<string, string> = {
      'user1': 'john.doe@example.com',
      'user2': 'jane.smith@example.com',
      'user3': 'mike.johnson@example.com',
    };
    return userEmails[this.currentUserId] || `user${this.currentUserId}@example.com`;
  }

  // Get user name based on ID
  getCurrentUserName(): string {
    const userNames: Record<string, string> = {
      'user1': 'John Doe',
      'user2': 'Jane Smith', 
      'user3': 'Mike Johnson',
    };
    return userNames[this.currentUserId] || `User ${this.currentUserId}`;
  }
}

// Singleton instance
export const mockUserContext = new MockUserContext();