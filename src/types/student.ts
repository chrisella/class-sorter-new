export type Gender = 'male' | 'female';
export type Rank = 1 | 2 | 3;

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  isEAL: boolean;
  behavior: Rank;
  ability: Rank;
  ehcp: boolean;
  send: boolean;
  ppg: boolean;
  preferredFriends: string[];      // Max 3 student IDs
  blacklistedStudents: string[];   // Cannot be in same class
  assignedClassId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentInput {
  name: string;
  gender: Gender;
  isEAL: boolean;
  behavior: Rank;
  ability: Rank;
  ehcp: boolean;
  send: boolean;
  ppg: boolean;
  preferredFriendNames: string[];      // Names for input, resolved to IDs
  blacklistedStudentNames: string[];   // Names for input, resolved to IDs
}

export interface SatisfactionScore {
  studentId: string;
  score: number;                     // 0-100
  preferredFriendsInClass: number;   // Count of preferred friends in same class
  maxPossibleFriends: number;        // Total preferred friends specified
  friendsMatched: string[];          // IDs of friends in same class
  hasBlacklistViolation: boolean;
}
