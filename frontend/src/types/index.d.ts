export interface UserProfile {
  name?: string;
  email?: string;
  position?: string;
  companyName?: string;
  companyDescription?: string;
}

export interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Email {
  to: string;
  subject: string;
  body: string;
  contactId?: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    email: string;
    company?: string;
    position?: string;
  };
}

export interface CacheInfo {
  size: number;
  lastUpdated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  technologies?: string[];
  industry?: string;
  challenges?: string[];
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  [key: string]: any;
}