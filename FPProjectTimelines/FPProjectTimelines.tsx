import * as React from 'react';
import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, User, Search, Filter, ChevronDown, ChevronUp, Activity, AlertTriangle, BarChart3, TrendingUp, Building } from 'lucide-react';
import { IInputs } from './generated/ManifestTypes';
import { VERSION_INFO } from '../version';

interface IFPProjectTimelinesProps {
  context: ComponentFramework.Context<IInputs>;
  width?: number;
  height?: number;
}

// Dataverse schema interfaces (reused from FPMyTasks)
interface DataverseTask {
  cr725_projecttasksid: string;
  cr725_name: string;
  cr725_note?: string;
  cr725_taskstate: number; // 0=Not Started, 1=In Progress, 2=Work Complete, 3=Cancelled
  cr725_startdate?: string;
  cr725_enddate?: string;
  cr725_percentdone?: number;
  _cr725_relatedproject_value: string;
  createdon: string;
  aubia_tasktype?: number; // 0=Task, 1=Milestone
  aubia_category?: number; // 0=General Operations, 1=Supply Chain, 2=DT/IT, 3=Human Resources
  // Expanded navigation properties
  cr725_RelatedProject?: {
    cr725_bihub_ideasid: string;
    cr725_title: string;
    cr725_department?: number;
    cr725_site?: number;
    cr725_currentprojectstatus?: number;
  };
}

interface DataverseResourceAssignment {
  cr725_resourceassignmentsid: string;
  _cr725_projecttask_value?: string;
  _cr725_taskref_value?: string;
  _cr725_resource_value: string;
  cr725_resource?: {
    systemuserid: string;
    fullname: string;
    internalemailaddress?: string;
  };
  cr725_TaskRef?: DataverseTask;
}

// Additional interfaces for API responses
interface DataverseApiResponse<T> {
  entities: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

// Extended assignment interface for API responses with expanded data
interface DataverseResourceAssignmentExpanded extends DataverseResourceAssignment {
  cr725_TaskRef?: DataverseTask;
}

interface DataverseUser {
  systemuserid: string;
  fullname: string;
  firstname?: string;
  lastname?: string;
  internalemailaddress?: string;
  domainname?: string;
}

interface DataverseProject {
  cr725_bihub_ideasid: string;
  cr725_title: string;
  cr725_id?: string;
  cr725_department?: number;
  cr725_site?: number;
  cr725_currentprojectstatus?: number;
  _cr725_projectowner_value?: string;
  cr725_projectowner?: DataverseUser;
  statecode?: number; // 0 = Active, 1 = Inactive
}

// UI-friendly interfaces for Resource Management
interface ResourceTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: Date;
  endDate?: Date;
  projectId: string;
  projectName: string;
  percentComplete?: number;
  createdOn: Date;
  taskType?: number; // 0=Task, 1=Milestone
  category?: number; // 0=General Operations, 1=Supply Chain, 2=DT/IT, 3=Human Resources
  // No hours - just task count for utilization
}

interface Resource {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department: string;
  site: string;
  tasks: ResourceTask[];
  totalTasks: number;
  overdueTasks: number;
  tasksThisWeek: number;
  currentUtilization: number; // Percentage
  weeklyUtilization: UtilizationWeek[]; // 12 months of weekly utilization
}

interface UtilizationWeek {
  weekStartDate: Date;
  weekEndDate: Date;
  activeTaskCount: number; // Number of active tasks this week
  utilizationLevel: 'low' | 'normal' | 'high' | 'overloaded'; // Relative to team
}


interface Filters {
  site: string;
  department: string;
  searchTerm: string;
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  department: string;
  site: string;
  tasks: ResourceTask[];
  overdueTasks: number;
}

interface ResourceWithProjects extends Omit<Resource, 'tasks'> {
  projects: ProjectGroup[];
  tasks: ResourceTask[]; // Keep for calculations
  underwayNow: number;
  startingNextMonth: number;
  startingNext3Months: number;
}

enum TaskStatus {
  NotStarted = 0,
  InProgress = 1,
  WorkComplete = 2,
  Cancelled = 3
}

const TaskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.NotStarted]: 'Not Started',
  [TaskStatus.InProgress]: 'In Progress',
  [TaskStatus.WorkComplete]: 'Completed',
  [TaskStatus.Cancelled]: 'Cancelled'
};

// Department and Site mappings - From ExecutionReview (REAL Dataverse option set values)
const DepartmentLabels: Record<number, string> = {
  747870000: 'Business Improvement',
  747870008: 'Business Information Solutions',
  747870001: 'Corporate',
  747870009: 'Digital Technology',
  747870002: 'Environment & Sustainability',
  747870003: 'Exploration',
  747870004: 'Finance',
  747870005: 'Geology',
  747870006: 'General Management',
  747870007: 'Human Resources',
  747870010: 'Maintenance - Fixed Plant',
  747870019: 'Maintenance - Mobile',
  747870020: 'Mine Planning',
  747870011: 'Mining - Open Pit',
  747870012: 'Mining - Underground',
  747870013: 'Processing',
  747870014: 'Safety',
  747870015: 'Site Administration',
  747870016: 'Supply Chain',
  747870017: 'Other'
};

const SiteLabels: Record<number, string> = {
  747870000: 'Iduapriem',
  747870001: 'Obuasi',
  747870002: 'Siguiri',
  747870003: 'Geita',
  747870016: 'Sukari',
  747870004: 'Cuiaba',
  747870005: 'Serra Grande - MSG',
  747870008: 'Cerro Vanguardia - CVSA',
  747870007: 'Sunrise Dam',
  747870009: 'Tropicana',
  747870014: 'Supply Chain - Global',
  747870017: 'Supply Chain - Regional',
  747870010: 'Perth Corporate Office',
  747870011: 'Brazil Regional Office',
  747870012: 'Denver Corporate Office',
  747870013: 'Johannesburg Corporate Office',
  747870015: 'Beatty District - Navada'
};

// Reverse mappings for filtering (name -> numeric value)
const SiteNameToValue: Record<string, number> = Object.entries(SiteLabels).reduce((acc, [value, label]) => {
  acc[label] = parseInt(value);
  return acc;
}, {} as Record<string, number>);

const DepartmentNameToValue: Record<string, number> = Object.entries(DepartmentLabels).reduce((acc, [value, label]) => {
  acc[label] = parseInt(value);
  return acc;
}, {} as Record<string, number>);

// Available sites - hardcoded list (exactly from ExecutionReview)
const AVAILABLE_SITES = [
  'Iduapriem',
  'Obuasi',
  'Siguiri',
  'Geita',
  'Sukari',
  'Cuiaba',
  'Serra Grande - MSG',
  'Cerro Vanguardia - CVSA',
  'Sunrise Dam',
  'Tropicana',
  'Supply Chain - Global'
];

// LocalStorage key for site preference
const SITE_PREFERENCE_KEY = 'fpResourceManagement_selectedSite';

// Add CSS animation keyframes to the document
if (typeof document !== 'undefined' && !document.getElementById('fp-resource-management-styles')) {
  const style = document.createElement('style');
  style.id = 'fp-resource-management-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      0% { opacity: 0; transform: translateY(10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .timeline-scroll {
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e0 #f7fafc;
    }
    .timeline-scroll::-webkit-scrollbar {
      height: 8px;
    }
    .timeline-scroll::-webkit-scrollbar-track {
      background: #f7fafc;
    }
    .timeline-scroll::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }
    .timeline-scroll::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }
  `;
  document.head.appendChild(style);
}

// Data transformation functions
const transformDataverseTask = (dvTask: DataverseTask): ResourceTask => ({
  id: dvTask.cr725_projecttasksid,
  title: dvTask.cr725_name,
  description: dvTask.cr725_note,
  status: dvTask.cr725_taskstate as TaskStatus,
  startDate: dvTask.cr725_startdate ? new Date(dvTask.cr725_startdate) : undefined,
  endDate: dvTask.cr725_enddate ? new Date(dvTask.cr725_enddate) : undefined,
  projectId: dvTask._cr725_relatedproject_value,
  projectName: dvTask.cr725_RelatedProject?.cr725_title || 'Unknown Project',
  percentComplete: dvTask.cr725_percentdone,
  createdOn: new Date(dvTask.createdon)
});

const getDepartmentLabel = (department?: number): string => {
  if (department === undefined || department === null) return 'Unknown';
  return DepartmentLabels[department] || `Department ${department}`;
};

const getSiteLabel = (site?: number): string => {
  if (site === undefined || site === null) return 'Unknown';
  return SiteLabels[site] || `Site ${site}`;
};

// Utility functions for date calculations
const getWeekStartDate = (date: Date): Date => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
  start.setHours(0, 0, 0, 0);
  return start;
};

const getWeekEndDate = (weekStart: Date): Date => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6); // End of week (Saturday)
  end.setHours(23, 59, 59, 999);
  return end;
};

const isTaskOverdue = (task: ResourceTask): boolean => {
  if (task.status === TaskStatus.WorkComplete) return false;

  const today = new Date();
  const isNotStartedPastStart = task.status === TaskStatus.NotStarted &&
    task.startDate && task.startDate < today;
  const isPastEndDate = task.endDate && task.endDate < today;

  return !!isNotStartedPastStart || !!isPastEndDate;
};

const isTaskDueThisWeek = (task: ResourceTask): boolean => {
  if (!task.endDate || task.status === TaskStatus.WorkComplete) return false;

  const today = new Date();
  const weekStart = getWeekStartDate(today);
  const weekEnd = getWeekEndDate(weekStart);

  return task.endDate >= weekStart && task.endDate <= weekEnd;
};

// Helper functions for new task timing metrics
const isTaskUnderwayNow = (task: ResourceTask): boolean => {
  return task.status === TaskStatus.InProgress;
};

const isTaskStartingNextMonth = (task: ResourceTask): boolean => {
  if (!task.startDate || task.status === TaskStatus.WorkComplete || task.status === TaskStatus.InProgress) return false;

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  return task.startDate >= nextMonth && task.startDate <= nextMonthEnd;
};

const isTaskStartingNext3Months = (task: ResourceTask): boolean => {
  if (!task.startDate || task.status === TaskStatus.WorkComplete || task.status === TaskStatus.InProgress) return false;

  const today = new Date();
  const threeMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());

  return task.startDate >= today && task.startDate <= threeMonthsFromNow;
};

// Helper to convert timeline range to weeks
const getWeeksFromRange = (range: 'all' | '12months' | '24months'): number | null => {
  if (range === '12months') return 52; // 12 months = 52 weeks
  if (range === '24months') return 104; // 24 months = 104 weeks
  return null; // 'all' returns null to indicate no limit
};

// Utility function needs to be defined before component
const generateWeeklyUtilization = (tasks: ResourceTask[], weeksToGenerate: number | null = 52, startWeekOffset = 0): UtilizationWeek[] => {
  const weeks: UtilizationWeek[] = [];
  const today = new Date();

  // If weeksToGenerate is null (All Time), calculate from task dates
  let actualWeeks = weeksToGenerate;
  if (weeksToGenerate === null && tasks.length > 0) {
    const taskDates = tasks.filter(t => t.endDate).map(t => t.endDate!.getTime());
    if (taskDates.length > 0) {
      const maxDate = new Date(Math.max(...taskDates));
      const daysDiff = Math.ceil((maxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      actualWeeks = Math.max(52, Math.ceil(daysDiff / 7)); // At least 52 weeks, or more if tasks extend further
    } else {
      actualWeeks = 52; // Default if no dates
    }
  } else if (weeksToGenerate === null) {
    actualWeeks = 52; // Default if no tasks
  }

  console.log(`Generating task-based utilization for ${tasks.length} tasks across ${actualWeeks} weeks starting at offset ${startWeekOffset}`);

  // Generate utilization data for specified number of weeks (including past weeks if offset is negative)
  for (let i = 0; i < actualWeeks!; i++) {
    const weekOffset = i + startWeekOffset; // Can be negative for past weeks
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (weekOffset * 7));
    const weekStartNormalized = getWeekStartDate(weekStart);
    const weekEnd = getWeekEndDate(weekStartNormalized);

    // Count active tasks for this week
    let activeTaskCount = 0;

    tasks.forEach(task => {
      if (task.status === TaskStatus.Cancelled || task.status === TaskStatus.WorkComplete) return;

      // For tasks without dates, assume they're active in first 8 weeks
      if (!task.startDate && !task.endDate) {
        if (i < 8) {
          activeTaskCount += 1;
        }
      } else if (task.startDate && task.endDate) {
        // Task has both start and end dates - check if week overlaps
        if (task.startDate <= weekEnd && task.endDate >= weekStartNormalized) {
          activeTaskCount += 1;
        }
      } else if (task.endDate) {
        // Task only has end date - active if not yet due
        if (task.endDate >= weekStartNormalized) {
          activeTaskCount += 1;
        }
      } else if (task.startDate) {
        // Task only has start date - active from start date onwards
        if (task.startDate <= weekEnd) {
          activeTaskCount += 1;
        }
      }
    });

    // Utilization level will be determined later when we know team averages
    weeks.push({
      weekStartDate: weekStartNormalized,
      weekEndDate: weekEnd,
      activeTaskCount,
      utilizationLevel: 'normal' // Will be updated later based on team comparison
    });
  }

  // Removed excessive logging - was spamming console
  return weeks;
};

export const FPProjectTimelines: React.FC<IFPProjectTimelinesProps> = ({ context, width, height }) => {
  // Get saved site from localStorage or default to first site
  const getInitialSite = () => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(SITE_PREFERENCE_KEY);
      if (saved && AVAILABLE_SITES.includes(saved)) {
        return saved;
      }
    }
    return AVAILABLE_SITES[0]; // Default to first site
  };

  const [resources, setResources] = useState<Resource[]>([]);
  const [allTasks, setAllTasks] = useState<ResourceTask[]>([]); // Store ALL tasks including those without assignments
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ site: getInitialSite(), department: 'all', searchTerm: '' });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showMilestones, setShowMilestones] = useState(true);
  const [milestoneFilter, setMilestoneFilter] = useState<'all' | 0 | 1 | 2 | 3>('all'); // all, General Operations, Supply Chain, DT/IT, HR

  // Mock data for development - comprehensive test data
  const generateMockResources = (): Resource[] => {
    const now = new Date();
    const resources: Resource[] = [
      {
        id: 'user1',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        department: 'Engineering',
        site: 'New York',
        tasks: [
          {
            id: 't1',
            title: 'Website Redesign - UI Development',
            status: TaskStatus.InProgress,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            projectId: 'p1',
            projectName: 'Website Redesign',
            percentComplete: 65,
            createdOn: new Date('2025-08-15'),
          },
          {
            id: 't2',
            title: 'API Integration',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
            endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
            projectId: 'p1',
            projectName: 'Website Redesign',
            createdOn: new Date('2025-08-20'),
          },
          {
            id: 't4',
            title: 'Database Migration',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            projectId: 'p3',
            projectName: 'Infrastructure Upgrade',
            createdOn: new Date('2025-08-20'),
          },
          {
            id: 't11',
            title: 'Security Audit Review',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago - OVERDUE
            endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            projectId: 'p4',
            projectName: 'Q4 Security',
            createdOn: new Date('2025-08-01'),
          }
        ],
        totalTasks: 4,
        overdueTasks: 1,
        tasksThisWeek: 1,
        currentUtilization: 3, // 3 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user2',
        name: 'Jane Smith',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        department: 'Marketing',
        site: 'London',
        tasks: [
          {
            id: 't3',
            title: 'Q4 Campaign Strategy',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
            projectId: 'p2',
            projectName: 'Q4 Marketing Campaign',
            percentComplete: 30,
            createdOn: new Date('2025-09-01'),
          },
          {
            id: 't5',
            title: 'Social Media Content Calendar',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
            endDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000), // 50 days from now
            projectId: 'p2',
            projectName: 'Q4 Marketing Campaign',
            percentComplete: 0,
            createdOn: new Date('2025-09-01'),
          },
          {
            id: 't12',
            title: 'Email Campaign Design',
            status: TaskStatus.WorkComplete,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            projectId: 'p2',
            projectName: 'Q4 Marketing Campaign',
            percentComplete: 100,
            createdOn: new Date('2025-08-01'),
          }
        ],
        totalTasks: 3,
        overdueTasks: 0,
        tasksThisWeek: 1,
        currentUtilization: 2, // 2 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user3',
        name: 'Michael Johnson',
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.johnson@company.com',
        department: 'Engineering',
        site: 'New York',
        tasks: [
          {
            id: 't6',
            title: 'Performance Optimization',
            status: TaskStatus.InProgress,
            startDate: new Date(),
            endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            projectId: 'p1',
            projectName: 'Website Redesign',
            percentComplete: 45,
            createdOn: new Date('2025-09-10'),
          },
          {
            id: 't7',
            title: 'Unit Test Coverage',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            projectId: 'p1',
            projectName: 'Website Redesign',
            percentComplete: 0,
            createdOn: new Date('2025-09-15'),
          }
        ],
        totalTasks: 2,
        overdueTasks: 0,
        tasksThisWeek: 0,
        currentUtilization: 2, // 2 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user4',
        name: 'Sarah Williams',
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah.williams@company.com',
        department: 'Product',
        site: 'Tokyo',
        tasks: [
          {
            id: 't8',
            title: 'User Research Analysis',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            projectId: 'p5',
            projectName: 'Product Discovery',
            percentComplete: 75,
            createdOn: new Date('2025-09-01'),
          },
          {
            id: 't9',
            title: 'Feature Specification',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
            projectId: 'p5',
            projectName: 'Product Discovery',
            percentComplete: 0,
            createdOn: new Date('2025-09-05'),
          },
          {
            id: 't13',
            title: 'Stakeholder Presentation',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            projectId: 'p5',
            projectName: 'Product Discovery',
            percentComplete: 0,
            createdOn: new Date('2025-09-20'),
          }
        ],
        totalTasks: 3,
        overdueTasks: 0,
        tasksThisWeek: 2,
        currentUtilization: 3, // 3 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user5',
        name: 'David Chen',
        firstName: 'David',
        lastName: 'Chen',
        email: 'david.chen@company.com',
        department: 'Engineering',
        site: 'Sydney',
        tasks: [
          {
            id: 't10',
            title: 'Mobile App Development',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            projectId: 'p6',
            projectName: 'Mobile Platform',
            percentComplete: 20,
            createdOn: new Date('2025-09-01'),
          },
          {
            id: 't14',
            title: 'Code Review - Auth Module',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
            projectId: 'p6',
            projectName: 'Mobile Platform',
            percentComplete: 0,
            createdOn: new Date('2025-09-22'),
          }
        ],
        totalTasks: 2,
        overdueTasks: 0,
        tasksThisWeek: 1,
        currentUtilization: 2, // 2 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user6',
        name: 'Emily Rodriguez',
        firstName: 'Emily',
        lastName: 'Rodriguez',
        email: 'emily.rodriguez@company.com',
        department: 'HR',
        site: 'New York',
        tasks: [
          {
            id: 't15',
            title: 'Q4 Recruitment Planning',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            projectId: 'p7',
            projectName: 'Talent Acquisition',
            percentComplete: 0,
            createdOn: new Date('2025-09-20'),
          }
        ],
        totalTasks: 1,
        overdueTasks: 0,
        tasksThisWeek: 0,
        currentUtilization: 1, // 1 active task
        weeklyUtilization: []
      },
      {
        id: 'user7',
        name: 'Alex Thompson',
        firstName: 'Alex',
        lastName: 'Thompson',
        email: 'alex.thompson@company.com',
        department: 'Engineering',
        site: 'London',
        tasks: [
          {
            id: 't16',
            title: 'Critical Bug Fixes - Payment System',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            projectId: 'p8',
            projectName: 'Payment Platform',
            percentComplete: 40,
            createdOn: new Date('2025-09-20'),
          },
          {
            id: 't17',
            title: 'Performance Monitoring Setup',
            status: TaskStatus.InProgress,
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            projectId: 'p8',
            projectName: 'Payment Platform',
            percentComplete: 20,
            createdOn: new Date('2025-09-15'),
          },
          {
            id: 't18',
            title: 'Security Vulnerability Patches',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            projectId: 'p4',
            projectName: 'Q4 Security',
            percentComplete: 0,
            createdOn: new Date('2025-09-22'),
          },
          {
            id: 't19',
            title: 'API Documentation Update',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            projectId: 'p8',
            projectName: 'Payment Platform',
            percentComplete: 0,
            createdOn: new Date('2025-09-18'),
          },
          {
            id: 't20',
            title: 'Load Testing Implementation',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            projectId: 'p9',
            projectName: 'Scaling Initiative',
            percentComplete: 0,
            createdOn: new Date('2025-09-10'),
          }
        ],
        totalTasks: 5,
        overdueTasks: 0,
        tasksThisWeek: 1,
        currentUtilization: 5, // 5 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user8',
        name: 'Lisa Park',
        firstName: 'Lisa',
        lastName: 'Park',
        email: 'lisa.park@company.com',
        department: 'Product',
        site: 'Sydney',
        tasks: [
          {
            id: 't21',
            title: 'Product Roadmap Q1 2026',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            projectId: 'p10',
            projectName: 'Product Strategy',
            percentComplete: 25,
            createdOn: new Date('2025-09-10'),
          },
          {
            id: 't22',
            title: 'Competitive Analysis Report',
            status: TaskStatus.InProgress,
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            projectId: 'p10',
            projectName: 'Product Strategy',
            percentComplete: 60,
            createdOn: new Date('2025-09-15'),
          },
          {
            id: 't23',
            title: 'User Journey Optimization',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            projectId: 'p11',
            projectName: 'UX Enhancement',
            percentComplete: 0,
            createdOn: new Date('2025-09-22'),
          },
          {
            id: 't24',
            title: 'Feature Requirements Documentation',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
            projectId: 'p11',
            projectName: 'UX Enhancement',
            percentComplete: 0,
            createdOn: new Date('2025-09-20'),
          },
          {
            id: 't25',
            title: 'Stakeholder Alignment Sessions',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            projectId: 'p10',
            projectName: 'Product Strategy',
            percentComplete: 30,
            createdOn: new Date('2025-09-18'),
          }
        ],
        totalTasks: 5,
        overdueTasks: 0,
        tasksThisWeek: 2,
        currentUtilization: 5, // 5 active tasks
        weeklyUtilization: []
      },
      {
        id: 'user9',
        name: 'Robert Martinez',
        firstName: 'Robert',
        lastName: 'Martinez',
        email: 'robert.martinez@company.com',
        department: 'Engineering',
        site: 'New York',
        tasks: [
          {
            id: 't26',
            title: 'Database Performance Tuning',
            status: TaskStatus.NotStarted,
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Started 5 days ago - OVERDUE
            endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Due yesterday
            projectId: 'p3',
            projectName: 'Infrastructure Upgrade',
            percentComplete: 0,
            createdOn: new Date('2025-09-01'),
          },
          {
            id: 't27',
            title: 'Microservices Migration Phase 1',
            status: TaskStatus.InProgress,
            startDate: new Date(),
            endDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000), // 6 weeks
            projectId: 'p12',
            projectName: 'Architecture Modernization',
            percentComplete: 15,
            createdOn: new Date('2025-09-20'),
          },
          {
            id: 't28',
            title: 'CI/CD Pipeline Enhancement',
            status: TaskStatus.InProgress,
            startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
            projectId: 'p12',
            projectName: 'Architecture Modernization',
            percentComplete: 35,
            createdOn: new Date('2025-09-18'),
          }
        ],
        totalTasks: 3,
        overdueTasks: 1,
        tasksThisWeek: 1,
        currentUtilization: 3, // 3 active tasks
        weeklyUtilization: []
      }
    ];

    // Generate weekly utilization for each resource
    return resources.map(resource => ({
      ...resource,
      weeklyUtilization: generateWeeklyUtilization(resource.tasks)
    }));
  };

  const mockResources = generateMockResources();

  useEffect(() => {
    initializeComponent();
  }, []);

  // Refetch data when site or department filter changes
  useEffect(() => {
    const refetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { resources: resourceData, allTasks: allTasksData } = await fetchResourceData(filters.site, filters.department);
        setResources(resourceData);
        setAllTasks(allTasksData);
      } catch (error) {
        console.error('Error refetching resource data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load resource data');
      } finally {
        setLoading(false);
      }
    };

    // Only refetch if we have a context (skip initial render and test harness)
    if (context.webAPI) {
      refetchData();
    }
  }, [filters.site, filters.department]);

  const initializeComponent = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch data with current filters
      const { resources: resourceData, allTasks: allTasksData } = await fetchResourceData(filters.site, filters.department);
      setResources(resourceData);
      setAllTasks(allTasksData);
    } catch (error) {
      console.error('Error initializing resource management component:', error);
      setError(error instanceof Error ? error.message : 'Failed to load resource data');

      // Use mock data as fallback
      setResources(mockResources);
      setAllTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch all records with automatic pagination
  const fetchAllRecords = async (
    entityName: string,
    query: string
  ): Promise<Record<string, unknown>[]> => {
    if (!context.webAPI) return [];

    const allRecords: Record<string, unknown>[] = [];
    let nextLink: string | undefined = undefined;
    let isFirstRequest = true;
    let pageCount = 0;

    try {
      do {
        pageCount++;
        const result = isFirstRequest
          ? await context.webAPI.retrieveMultipleRecords(entityName, query)
          : await context.webAPI.retrieveMultipleRecords(entityName, nextLink ?? '');

        const entities = (result?.entities ?? []) as Record<string, unknown>[];
        allRecords.push(...entities);

        console.log(`${entityName} - Page ${pageCount}: Fetched ${entities.length} records, Total: ${allRecords.length}`);

        nextLink = result?.nextLink as string | undefined;
        isFirstRequest = false;

        // Safety check to prevent infinite loops
        if (allRecords.length > 50000) {
          console.warn(`Reached safety limit of 50000 records for ${entityName}`);
          break;
        }
      } while (nextLink);

      console.log(`${entityName} - Completed: ${allRecords.length} total records across ${pageCount} pages`);
      return allRecords;
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, (error as Error)?.message ?? error);
      return allRecords; // Return what we got so far
    }
  };

  const fetchResourceData = async (siteFilter?: string, departmentFilter?: string): Promise<{ resources: Resource[], allTasks: ResourceTask[] }> => {
    try {
      // In test harness, webAPI might not be available, so use mock data
      if (!context.webAPI) {
        console.warn('WebAPI not available, using mock resource data for test harness');
        // Mock data already has utilization calculated in generateMockResources
        return { resources: mockResources, allTasks: [] };
      }

      console.log('Fetching resource data with filters:', { site: siteFilter, department: departmentFilter });

      // Site filter is REQUIRED (no "all" option)
      if (!siteFilter || siteFilter === 'all') {
        console.error('Site filter is required but not provided');
        return { resources: [], allTasks: [] };
      }

      const siteValue = SiteNameToValue[siteFilter];
      if (!siteValue) {
        console.error(`Unknown site: ${siteFilter}`);
        return { resources: [], allTasks: [] };
      }

      // Step 1: Fetch PROJECTS filtered by site (like ExecutionReview does)
      const projectFilterParts: string[] = [
        'cr725_projectclosed ne true',
        'statecode eq 0',
        'cr725_fullassetpotentialinitative eq true',
        `cr725_site eq ${siteValue}`
      ];

      if (departmentFilter && departmentFilter !== 'all') {
        const deptValue = DepartmentNameToValue[departmentFilter];
        if (deptValue) {
          projectFilterParts.push(`cr725_department eq ${deptValue}`);
        }
      }

      const projectsQuery = `?$select=cr725_bihub_ideasid,cr725_title,cr725_id,cr725_department,cr725_site&$filter=${projectFilterParts.join(' and ')}`;
      const projectEntities = await fetchAllRecords('cr725_bihub_ideas', projectsQuery) as unknown as {cr725_bihub_ideasid: string, cr725_title: string, cr725_department?: number, cr725_site?: number}[];
      console.log(`Found ${projectEntities.length} projects at ${siteFilter}`);

      if (projectEntities.length === 0) {
        console.log('No projects found for selected filters');
        return { resources: [], allTasks: [] };
      }

      // Step 2: Fetch tasks for those projects (in batches to avoid URL length limits)
      const projectIds = projectEntities.map(p => p.cr725_bihub_ideasid);
      const taskBatchSize = 50;
      const allTaskEntities: DataverseTask[] = [];

      for (let i = 0; i < projectIds.length; i += taskBatchSize) {
        const batch = projectIds.slice(i, i + taskBatchSize);
        const projectFilter = batch.map(id => `_cr725_relatedproject_value eq '${id}'`).join(' or ');
        const tasksQuery = `?$filter=(${projectFilter}) and cr725_taskstate ne 3&$select=cr725_projecttasksid,cr725_name,cr725_note,cr725_taskstate,cr725_startdate,cr725_enddate,cr725_percentdone,_cr725_relatedproject_value,createdon,aubia_tasktype,aubia_category`;

        const batchTasks = await fetchAllRecords('cr725_projecttasks', tasksQuery) as unknown as DataverseTask[];
        allTaskEntities.push(...batchTasks);
      }

      const taskEntities = allTaskEntities;
      console.log(`Found ${taskEntities.length} tasks across ${projectEntities.length} projects`);

      if (taskEntities.length === 0) {
        console.log('No tasks found for selected projects');
        return { resources: [], allTasks: [] };
      }

      // Create project lookup map
      const projectMap = new Map(projectEntities.map(p => [p.cr725_bihub_ideasid, p]));

      // Step 3: Get unique task IDs to fetch resource assignments
      const taskIds = taskEntities.map(task => task.cr725_projecttasksid);

      // Step 3: Fetch resource assignments for these specific tasks (in batches)
      console.log(`Fetching resource assignments for ${taskIds.length} tasks...`);
      const batchSize = 50;
      const assignmentBatches: Record<string, unknown>[] = [];

      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batch = taskIds.slice(i, i + batchSize);
        const assignmentFilter = batch.map(id => `_cr725_taskref_value eq '${id}'`).join(' or ');
        const assignmentsQuery = `?$select=cr725_resourceassignmentsid,_cr725_taskref_value,_cr725_resource_value&$filter=${assignmentFilter}`;

        const batchAssignments = await fetchAllRecords('cr725_resourceassignments', assignmentsQuery);
        assignmentBatches.push(...batchAssignments);
      }

      const basicAssignmentEntities = assignmentBatches as unknown as DataverseResourceAssignment[];
      console.log('Found', basicAssignmentEntities.length, 'resource assignments for filtered tasks');

      // Extract unique user IDs from assignments
      const userIdsFromAssignments = new Set(basicAssignmentEntities
        .map(a => a._cr725_resource_value)
        .filter(id => id));
      console.log('Found', userIdsFromAssignments.size, 'unique users with assignments');

      // Step 4: Fetch only the users who have resource assignments (with pagination)
      const userEntities: DataverseUser[] = [];
      if (userIdsFromAssignments.size > 0) {
        // Batch user queries if needed (max 50 users per query to avoid URL length limits)
        const userIdArray = Array.from(userIdsFromAssignments);
        const userBatchSize = 50;

        console.log(`Fetching ${userIdArray.length} users in ${Math.ceil(userIdArray.length / userBatchSize)} batches...`);

        for (let i = 0; i < userIdArray.length; i += userBatchSize) {
          const batch = userIdArray.slice(i, i + userBatchSize);
          const usersQuery = `?$filter=${batch.map(id => `systemuserid eq '${id}'`).join(' or ')}&$select=systemuserid,fullname,firstname,lastname,internalemailaddress`;

          // Use fetchAllRecords to handle pagination (in case a batch has pagination)
          const batchUsers = await fetchAllRecords('systemuser', usersQuery);
          userEntities.push(...batchUsers as unknown as DataverseUser[]);
        }
      }
      console.log('Fetched', userEntities.length, 'users with assignments');
      console.log('Expected users based on assignments:', userIdsFromAssignments.size);

      // Step 4: Create a map of task ID to task data (we already fetched tasks with filters)
      const taskMap = new Map<string, DataverseTask>();
      taskEntities.forEach((task: DataverseTask) => {
        taskMap.set(task.cr725_projecttasksid, task);
      });

      // Combine assignments with task data
      const allAssignments: DataverseResourceAssignmentExpanded[] = basicAssignmentEntities.map((assignment: DataverseResourceAssignment): DataverseResourceAssignmentExpanded => {
        const taskId = assignment._cr725_taskref_value || assignment._cr725_projecttask_value;
        const taskData = taskId ? taskMap.get(taskId) : undefined;
        return {
          ...assignment,
          cr725_TaskRef: taskData
        };
      });

      // Step 5: Group assignments by user and transform data
      const userResourceMap = new Map<string, Resource>();

      // Initialize users with resource assignments
      userEntities.forEach((user: DataverseUser) => {
        userResourceMap.set(user.systemuserid, {
          id: user.systemuserid,
          name: user.fullname,
          firstName: user.firstname,
          lastName: user.lastname,
          email: user.internalemailaddress,
          department: 'Unknown',
          site: 'Unknown',
          tasks: [],
          totalTasks: 0,
          overdueTasks: 0,
          tasksThisWeek: 0,
          currentUtilization: 0,
          weeklyUtilization: []
        });
      });

      // Process assignments and build task data
      const departmentCounts = new Map<string, number>();
      const siteCounts = new Map<string, number>();

      allAssignments.forEach((assignment: DataverseResourceAssignmentExpanded) => {
        const userId = assignment._cr725_resource_value;
        const taskData = assignment.cr725_TaskRef;

        if (!userId || !taskData) return;

        const resource = userResourceMap.get(userId);
        if (!resource) return;

        // Get project data from our project map
        const project = projectMap.get(taskData._cr725_relatedproject_value);

        // Transform task data
        const task: ResourceTask = {
          id: taskData.cr725_projecttasksid,
          title: taskData.cr725_name,
          description: taskData.cr725_note,
          status: taskData.cr725_taskstate as TaskStatus,
          startDate: taskData.cr725_startdate ? new Date(taskData.cr725_startdate) : undefined,
          endDate: taskData.cr725_enddate ? new Date(taskData.cr725_enddate) : undefined,
          projectId: taskData._cr725_relatedproject_value,
          projectName: project?.cr725_title || 'Unknown Project',
          percentComplete: taskData.cr725_percentdone,
          createdOn: new Date(taskData.createdon),
          taskType: taskData.aubia_tasktype,
          category: taskData.aubia_category
        };

        resource.tasks.push(task);

        // Update department and site from PROJECT data (from our project map)
        const department = getDepartmentLabel(project?.cr725_department);
        const site = getSiteLabel(project?.cr725_site);

        // Use most common department/site for this user
        const userDeptKey = `${userId}-dept-${department}`;
        const userSiteKey = `${userId}-site-${site}`;

        departmentCounts.set(userDeptKey, (departmentCounts.get(userDeptKey) || 0) + 1);
        siteCounts.set(userSiteKey, (siteCounts.get(userSiteKey) || 0) + 1);
      });

      // NEW: Transform ALL task entities into ResourceTask format (including tasks without assignments)
      const allTasksList: ResourceTask[] = taskEntities.map((taskData: DataverseTask) => {
        const project = projectMap.get(taskData._cr725_relatedproject_value);

        return {
          id: taskData.cr725_projecttasksid,
          title: taskData.cr725_name,
          description: taskData.cr725_note,
          status: taskData.cr725_taskstate as TaskStatus,
          startDate: taskData.cr725_startdate ? new Date(taskData.cr725_startdate) : undefined,
          endDate: taskData.cr725_enddate ? new Date(taskData.cr725_enddate) : undefined,
          projectId: taskData._cr725_relatedproject_value,
          projectName: project?.cr725_title || 'Unknown Project',
          percentComplete: taskData.cr725_percentdone,
          createdOn: new Date(taskData.createdon),
          taskType: taskData.aubia_tasktype,
          category: taskData.aubia_category
        };
      });

      // Step 4: Calculate metrics for each resource
      userResourceMap.forEach((resource, userId) => {
        // Set most common department and site
        let maxDeptCount = 0;
        let maxSiteCount = 0;

        departmentCounts.forEach((count, key) => {
          if (key.startsWith(`${userId}-dept-`) && count > maxDeptCount) {
            maxDeptCount = count;
            resource.department = key.replace(`${userId}-dept-`, '');
          }
        });

        siteCounts.forEach((count, key) => {
          if (key.startsWith(`${userId}-site-`) && count > maxSiteCount) {
            maxSiteCount = count;
            resource.site = key.replace(`${userId}-site-`, '');
          }
        });

        // Calculate task metrics
        resource.totalTasks = resource.tasks.length;
        resource.overdueTasks = resource.tasks.filter(task => isTaskOverdue(task)).length;
        resource.tasksThisWeek = resource.tasks.filter(task => isTaskDueThisWeek(task)).length;

        // Calculate active task count (utilization will be relative to group later)
        const activeTasks = resource.tasks.filter(task =>
          task.status === TaskStatus.InProgress || task.status === TaskStatus.NotStarted
        );
        resource.currentUtilization = activeTasks.length; // Store raw count temporarily

        // Generate weekly utilization
        resource.weeklyUtilization = generateWeeklyUtilization(resource.tasks);
      });

      // Step 5: Get unique departments from the filtered projects
      const uniqueDepartments = new Set<string>();

      projectEntities.forEach(project => {
        const department = getDepartmentLabel(project.cr725_department);
        if (department && department !== 'Unknown') {
          uniqueDepartments.add(department);
        }
      });

      setAvailableDepartments(Array.from(uniqueDepartments).sort());

      console.log('Found departments at selected site:', Array.from(uniqueDepartments));

      // Step 6: Filter out users with no tasks
      const resourcesWithTasks = Array.from(userResourceMap.values())
        .filter(resource => resource.tasks.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log('Processed resources:', resourcesWithTasks);
      console.log('Total tasks (including unassigned):', allTasksList.length);
      return { resources: resourcesWithTasks, allTasks: allTasksList };

    } catch (error) {
      console.error('Error fetching resource data:', error);

      // Return mock data as fallback
      return {
        resources: mockResources.map(resource => ({
          ...resource,
          weeklyUtilization: generateWeeklyUtilization(resource.tasks)
        })),
        allTasks: []
      };
    }
  };



  // Calculate relative utilization for filtered resources
  const calculateRelativeUtilization = (resourceList: Resource[]): Resource[] => {
    const totalActiveTasks = resourceList.reduce((sum, resource) => sum + resource.currentUtilization, 0);

    if (totalActiveTasks === 0) {
      return resourceList.map(resource => ({
        ...resource,
        currentUtilization: 0
      }));
    }

    return resourceList.map(resource => ({
      ...resource,
      currentUtilization: Math.round((resource.currentUtilization / totalActiveTasks) * 100)
    }));
  };

  const baseFilteredResources = resources.filter(resource => {
    const resourceSite = resource.site || 'Unknown';
    const resourceDept = resource.department || 'Unknown';

    const matchesSite = filters.site === 'all' || resourceSite === filters.site;
    const matchesDepartment = filters.department === 'all' || resourceDept === filters.department;
    const matchesSearch = filters.searchTerm === '' ||
      (resource.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase());

    return matchesSite && matchesDepartment && matchesSearch;
  });

  const filteredResources = calculateRelativeUtilization(baseFilteredResources);

  const toggleProjectExpansion = (resourceId: string, projectId: string) => {
    const key = `${resourceId}-${projectId}`;
    setExpandedProjects((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Group tasks by project for each resource
  const getResourcesWithProjects = (filteredRes: Resource[]): ResourceWithProjects[] => {
    return filteredRes.map(resource => {
      const projectMap = new Map<string, ProjectGroup>();

      // Calculate new metrics
      let underwayNow = 0;
      let startingNextMonth = 0;
      let startingNext3Months = 0;

      resource.tasks.forEach(task => {
        if (!projectMap.has(task.projectId)) {
          projectMap.set(task.projectId, {
            projectId: task.projectId,
            projectName: task.projectName,
            department: resource.department,
            site: resource.site,
            tasks: [],
            overdueTasks: 0
          });
        }

        const projectGroup = projectMap.get(task.projectId)!;
        projectGroup.tasks.push(task);
        if (isTaskOverdue(task)) {
          projectGroup.overdueTasks++;
        }

        // Calculate new timing metrics
        if (isTaskUnderwayNow(task)) {
          underwayNow++;
        }
        if (isTaskStartingNextMonth(task)) {
          startingNextMonth++;
        }
        if (isTaskStartingNext3Months(task)) {
          startingNext3Months++;
        }
      });

      return {
        ...resource,
        projects: Array.from(projectMap.values()).sort((a, b) => a.projectName.localeCompare(b.projectName)),
        underwayNow,
        startingNextMonth,
        startingNext3Months
      };
    });
  };

  const resourcesWithProjects = getResourcesWithProjects(filteredResources)
    .sort((a, b) => b.totalTasks - a.totalTasks); // Sort by total tasks descending

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: height || '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{
            fontSize: '16px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            Loading resource data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: height || '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#f97316" />
          <div>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#dc2626',
              marginBottom: '8px'
            }}>
              Error Loading Data
            </div>
            <div style={{
              fontSize: '14px',
              color: '#7f1d1d'
            }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: height || '800px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 24px 0 24px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Calendar size={28} color="#d97706" />
              Project Timeline Dashboard
            </h1>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            textAlign: 'right'
          }}>
            {VERSION_INFO.getDisplayVersion()}
          </div>
        </div>

{/* Filters */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={16} color="#64748b" />
            <select
              aria-label="Filter by site"
              value={filters.site}
              onChange={(e) => {
                if (e?.target?.value !== undefined) {
                  const newValue = e.target.value;
                  // Save to localStorage
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(SITE_PREFERENCE_KEY, newValue);
                  }
                  setFilters(prev => ({ ...prev, site: newValue, department: 'all' })); // Reset department when site changes
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minWidth: '150px'
              }}
            >
              {AVAILABLE_SITES.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="#64748b" />
            <select
              aria-label="Filter by department"
              value={filters.department}
              onChange={(e) => {
                if (e?.target?.value !== undefined) {
                  const newValue = e.target.value;
                  setFilters(prev => ({ ...prev, department: newValue }));
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                minWidth: '150px'
              }}
            >
              <option value="all">All Departments</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search resources..."
              value={filters.searchTerm}
              onChange={(e) => {
                if (e?.target?.value !== undefined) {
                  const newValue = e.target.value;
                  setFilters(prev => ({ ...prev, searchTerm: newValue }));
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                minWidth: '200px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 24px 24px 24px'
      }}>
        {/* Project Timeline View - Redesigned with Company Branding */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {/* Project Timeline Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px 32px',
              backgroundColor: '#ffffff',
              borderBottom: '2px solid #d4a574'
            }}>
              <BarChart3 size={24} color="#d97706" />
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Project Timeline
                </h3>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  {(() => {
                    const projectMap = new Map<string, { name: string; startDate: Date | null; endDate: Date | null; taskCount: number }>();
                    filteredResources.forEach(resource => {
                      resource.tasks.forEach(task => {
                        if (!projectMap.has(task.projectId)) {
                          projectMap.set(task.projectId, {
                            name: task.projectName,
                            startDate: task.startDate || null,
                            endDate: task.endDate || null,
                            taskCount: 1
                          });
                        } else {
                          const proj = projectMap.get(task.projectId)!;
                          proj.taskCount++;
                          if (task.startDate && (!proj.startDate || task.startDate < proj.startDate)) {
                            proj.startDate = task.startDate;
                          }
                          if (task.endDate && (!proj.endDate || task.endDate > proj.endDate)) {
                            proj.endDate = task.endDate;
                          }
                        }
                      });
                    });
                    return `Resource planning and operational timeline • ${projectMap.size} active projects`;
                  })()}
                </div>
              </div>
            </div>

            {/* Timeline Legend */}
            <div style={{
              padding: '12px 32px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #e5e5e0',
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
              fontSize: '13px',
              color: '#666'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <polygon points="8,2 14,8 8,14" fill="#d97706" />
                </svg>
                <span>Key Milestone</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '12px',
                  backgroundColor: '#9c8e74',
                  border: '2px solid #ffffff',
                  borderRadius: '2px'
                }} />
                <span>Project Phase</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#fb923c',
                  border: '1px solid #d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  5
                </div>
                <span>Active Projects (per month)</span>
              </div>

              {/* Milestone Toggle Controls */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  <input
                    type="checkbox"
                    checked={showMilestones}
                    onChange={(e) => setShowMilestones(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Show Milestones
                </label>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#666', marginRight: '4px', fontWeight: '600' }}>Filter:</span>
                    <button
                      onClick={() => setMilestoneFilter('all')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: milestoneFilter === 'all' ? '2px solid #d97706' : '1px solid #d1d5db',
                        backgroundColor: milestoneFilter === 'all' ? '#fff7ed' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#1a1a1a'
                      }}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setMilestoneFilter(0)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: milestoneFilter === 0 ? '2px solid #94a3b8' : '1px solid #d1d5db',
                        backgroundColor: milestoneFilter === 0 ? '#f1f5f9' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,5 5,10 0,5" fill="#94a3b8" />
                      </svg>
                      General
                    </button>
                    <button
                      onClick={() => setMilestoneFilter(1)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: milestoneFilter === 1 ? '2px solid #fbbf24' : '1px solid #d1d5db',
                        backgroundColor: milestoneFilter === 1 ? '#fef9c3' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#713f12',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,5 5,10 0,5" fill="#fbbf24" />
                      </svg>
                      Supply
                    </button>
                    <button
                      onClick={() => setMilestoneFilter(2)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: milestoneFilter === 2 ? '2px solid #d946ef' : '1px solid #d1d5db',
                        backgroundColor: milestoneFilter === 2 ? '#f3e8ff' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#581c87',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,5 5,10 0,5" fill="#d946ef" />
                      </svg>
                      DT/IT
                    </button>
                    <button
                      onClick={() => setMilestoneFilter(3)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: milestoneFilter === 3 ? '2px solid #34d399' : '1px solid #d1d5db',
                        backgroundColor: milestoneFilter === 3 ? '#d1fae5' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#065f46',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,5 5,10 0,5" fill="#34d399" />
                      </svg>
                      HR
                    </button>
                </div>
              </div>
            </div>

            {/* Timeline Content */}
            <div style={{ width: '100%' }}>
              {(() => {
                // Build project map with aggregated dates and department
                // Use ALL tasks (not just assigned ones) to ensure milestones are included
                const projectMap = new Map<string, {
                  name: string;
                  startDate: Date | null;
                  endDate: Date | null;
                  taskCount: number;
                  tasks: ResourceTask[];
                  department: string;
                }>();

                // Get department lookup from resources
                const departmentLookup = new Map<string, string>();
                filteredResources.forEach(resource => {
                  resource.tasks.forEach(task => {
                    if (!departmentLookup.has(task.projectId)) {
                      departmentLookup.set(task.projectId, resource.department || 'Unknown');
                    }
                  });
                });

                // Use ALL tasks to build project map (includes milestones without resource assignments)
                allTasks.forEach(task => {
                  if (!projectMap.has(task.projectId)) {
                    projectMap.set(task.projectId, {
                      name: task.projectName,
                      startDate: task.startDate || null,
                      endDate: task.endDate || null,
                      taskCount: 1,
                      tasks: [task],
                      department: departmentLookup.get(task.projectId) || 'Unknown'
                    });
                  } else {
                    const proj = projectMap.get(task.projectId)!;
                    proj.taskCount++;
                    proj.tasks.push(task);
                    if (task.startDate && (!proj.startDate || task.startDate < proj.startDate)) {
                      proj.startDate = task.startDate;
                    }
                    if (task.endDate && (!proj.endDate || task.endDate > proj.endDate)) {
                      proj.endDate = task.endDate;
                    }
                  }
                });

                const projects = Array.from(projectMap.entries())
                  .map(([id, data]) => ({ id, ...data }))
                  .filter(p => p.startDate && p.endDate);

                const filteredProjects = projects;

                // Group by department
                const projectsByDept = new Map<string, typeof filteredProjects>();
                filteredProjects.forEach(project => {
                  const dept = project.department;
                  if (!projectsByDept.has(dept)) {
                    projectsByDept.set(dept, []);
                  }
                  projectsByDept.get(dept)!.push(project);
                });

                // Sort projects within each department by start date
                projectsByDept.forEach(deptProjects => {
                  deptProjects.sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());
                });

                if (projects.length === 0) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '80px 32px',
                      color: '#999'
                    }}>
                      <BarChart3 size={56} color="#d4a574" style={{ margin: '0 auto 20px' }} />
                      <p style={{
                        fontSize: '15px',
                        color: '#666',
                        margin: 0,
                        fontWeight: '500'
                      }}>
                        No projects with scheduled dates found
                      </p>
                      <p style={{
                        fontSize: '13px',
                        color: '#999',
                        margin: '8px 0 0 0'
                      }}>
                        Adjust filters to view project timelines
                      </p>
                    </div>
                  );
                }

                // Helper function to get milestone color by category
                const getMilestoneColor = (category?: number): string => {
                  switch (category) {
                    case 0: return '#94a3b8'; // General Operations - Light slate
                    case 1: return '#fbbf24'; // Supply Chain - Bright yellow
                    case 2: return '#d946ef'; // DT/IT - Magenta
                    case 3: return '#34d399'; // Human Resources - Light green
                    default: return '#d97706'; // Default - Orange
                  }
                };

                const getCategoryLabel = (category?: number): string => {
                  switch (category) {
                    case 0: return 'General Operations';
                    case 1: return 'Supply Chain';
                    case 2: return 'DT/IT';
                    case 3: return 'Human Resources';
                    default: return 'Uncategorized';
                  }
                };

                // Calculate timeline bounds - Show 24 months from first project start for scrolling
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Get earliest project start date
                const allStartDates = filteredProjects.filter(p => p.startDate).map(p => p.startDate!.getTime());
                const minDate = new Date(Math.min(...allStartDates));

                // Set to start of month
                minDate.setDate(1);
                minDate.setHours(0, 0, 0, 0);

                // End date is 24 months from start to allow scrolling
                const maxDate = new Date(minDate);
                maxDate.setMonth(maxDate.getMonth() + 24);
                maxDate.setDate(0); // Last day of the 24th month

                const timelineSpanMs = maxDate.getTime() - minDate.getTime();

                // Generate month headers with year tracking
                const months: { label: string; offsetPercent: number; widthPercent: number; monthName: string; year: number }[] = [];
                const currentMonth = new Date(minDate);
                currentMonth.setDate(1);

                while (currentMonth <= maxDate) {
                  const monthStart = new Date(currentMonth);
                  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

                  const offsetMs = monthStart.getTime() - minDate.getTime();
                  const offsetPercent = (offsetMs / timelineSpanMs) * 100;

                  const monthSpanMs = Math.min(monthEnd.getTime(), maxDate.getTime()) - monthStart.getTime();
                  const widthPercent = (monthSpanMs / timelineSpanMs) * 100;

                  months.push({
                    label: monthStart.toLocaleDateString('en-US', { month: 'long' }),
                    monthName: monthStart.toLocaleDateString('en-US', { month: 'short' }),
                    year: monthStart.getFullYear(),
                    offsetPercent,
                    widthPercent
                  });

                  currentMonth.setMonth(currentMonth.getMonth() + 1);
                }

                // Generate year headers
                const years: { year: number; offsetPercent: number; widthPercent: number }[] = [];
                let currentYear = months[0]?.year;
                let yearStartOffset = months[0]?.offsetPercent || 0;

                months.forEach((month, idx) => {
                  if (month.year !== currentYear || idx === months.length - 1) {
                    const yearEndOffset = idx === months.length - 1
                      ? month.offsetPercent + month.widthPercent
                      : month.offsetPercent;

                    if (idx === months.length - 1 && month.year === currentYear) {
                      years.push({
                        year: currentYear,
                        offsetPercent: yearStartOffset,
                        widthPercent: yearEndOffset - yearStartOffset
                      });
                    } else {
                      years.push({
                        year: currentYear,
                        offsetPercent: yearStartOffset,
                        widthPercent: yearEndOffset - yearStartOffset
                      });
                      currentYear = month.year;
                      yearStartOffset = month.offsetPercent;
                    }
                  }
                });

                // Calculate project count per month for display
                const monthProjectCounts = new Map<string, number>();
                months.forEach((month) => {
                  const monthStart = new Date(minDate.getTime() + (month.offsetPercent / 100) * timelineSpanMs);
                  const monthEnd = new Date(monthStart.getTime() + (month.widthPercent / 100) * timelineSpanMs);

                  let count = 0;
                  filteredProjects.forEach(project => {
                    if (project.startDate && project.endDate) {
                      // Check if project overlaps with this month
                      if (project.startDate <= monthEnd && project.endDate >= monthStart) {
                        count++;
                      }
                    }
                  });
                  monthProjectCounts.set(month.label, count);
                });

                // Helper function to get circle color based on count
                const getCircleColor = (count: number): string => {
                  if (count === 0) return '#f5f5f0';
                  if (count <= 2) return '#ffffff';
                  if (count <= 4) return '#fed7aa';
                  if (count <= 6) return '#fdba74';
                  if (count <= 8) return '#fb923c';
                  return '#f97316';
                };

                return (
                  <div style={{ padding: '32px', width: '100%', backgroundColor: '#ffffff' }}>
                    {/* Scrollable Timeline Container */}
                    <div style={{ overflowX: 'auto', width: '100%', position: 'relative' }}>
                      {/* Year Headers Row */}
                      <div style={{
                        display: 'flex',
                        marginBottom: '8px',
                        minWidth: '2400px'
                      }}>
                      <div style={{ width: '280px', flexShrink: 0 }} />
                      <div style={{
                        flex: 1,
                        position: 'relative',
                        height: '30px',
                        marginLeft: '24px'
                      }}>
                        {years.map((yearData, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'absolute',
                              left: `${yearData.offsetPercent}%`,
                              width: `${yearData.widthPercent}%`,
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1a1a1a',
                              paddingLeft: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              borderLeft: idx === 0 ? 'none' : '2px solid #d4a574'
                            }}
                          >
                            {yearData.year}
                          </div>
                        ))}
                      </div>
                    </div>

                      {/* Month Headers Row */}
                      <div style={{
                        display: 'flex',
                        marginBottom: '20px',
                        borderBottom: '2px solid #d4a574',
                        minWidth: '2400px'
                      }}>
                      <div style={{ width: '280px', flexShrink: 0 }} />
                      <div style={{
                        flex: 1,
                        position: 'relative',
                        height: '65px',
                        marginLeft: '24px'
                      }}>
                        {months.map((month, idx) => {
                          const projectCount = monthProjectCounts.get(month.label) || 0;
                          const circleColor = getCircleColor(projectCount);
                          const textColor = projectCount > 4 ? '#ffffff' : '#1a1a1a';

                          return (
                            <div
                              key={idx}
                              style={{
                                position: 'absolute',
                                left: `${month.offsetPercent}%`,
                                width: `${month.widthPercent}%`,
                                borderLeft: idx === 0 ? 'none' : '1px solid #d4a574',
                                paddingLeft: '12px',
                                paddingTop: '4px',
                                paddingBottom: '8px'
                              }}
                            >
                              {/* Project Count Circle */}
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: circleColor,
                                border: projectCount === 0 ? '1px solid #d4a574' : '1px solid #d97706',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: textColor,
                                marginBottom: '6px'
                              }}>
                                {projectCount}
                              </div>
                              {/* Month Name */}
                              <div style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#1a1a1a',
                                textTransform: 'capitalize'
                              }}>
                                {month.label}
                              </div>
                            </div>
                          );
                        })}
                        {/* Today Marker in Header */}
                        {(() => {
                          const todayMs = today.getTime() - minDate.getTime();
                          const todayPercent = (todayMs / timelineSpanMs) * 100;
                          if (todayPercent >= 0 && todayPercent <= 100) {
                            return (
                              <>
                                <div style={{
                                  position: 'absolute',
                                  left: `${todayPercent}%`,
                                  top: '0',
                                  bottom: '-8px',
                                  width: '3px',
                                  backgroundColor: '#d97706',
                                  zIndex: 200,
                                  transform: 'translateX(-1.5px)'
                                }} />
                                <div style={{
                                  position: 'absolute',
                                  left: `${todayPercent}%`,
                                  top: '-20px',
                                  transform: 'translateX(-50%)',
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  color: '#d97706',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: '#ffffff',
                                  padding: '2px 4px',
                                  borderRadius: '3px',
                                  border: '1px solid #d97706',
                                  zIndex: 201
                                }}>
                                  Today
                                </div>
                              </>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                      {/* Project Swimlanes - Grouped by Department */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: '2400px', position: 'relative' }}>
                      {Array.from(projectsByDept.entries()).map(([department, deptProjects]) => (
                        <div key={department} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Department Swimlane Header */}
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#1a1a1a',
                            padding: '12px 16px',
                            backgroundColor: '#e8e5d9',
                            borderLeft: '4px solid #d97706',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {department}
                            <span style={{
                              marginLeft: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#666',
                              textTransform: 'none',
                              letterSpacing: 'normal'
                            }}>
                              {deptProjects.length} {deptProjects.length === 1 ? 'project' : 'projects'}
                            </span>
                          </div>

                          {/* Projects in this department */}
                          {deptProjects.map((project, projIdx) => {
                            const startOffset = project.startDate!.getTime() - minDate.getTime();
                            const projectSpan = project.endDate!.getTime() - project.startDate!.getTime();
                            const leftPercent = (startOffset / timelineSpanMs) * 100;
                            const widthPercent = (projectSpan / timelineSpanMs) * 100;

                            return (
                              <div
                                key={project.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  minHeight: '48px',
                                  backgroundColor: projIdx % 2 === 0 ? '#ffffff' : '#f9f9f7',
                                  padding: '8px 0',
                                  borderLeft: '2px solid #e5e5e0'
                                }}
                              >
                                {/* Project Name Column */}
                                <div style={{
                                  width: '280px',
                                  paddingLeft: '16px',
                                  paddingRight: '16px',
                                  fontSize: '14px',
                                  color: '#1a1a1a',
                                  flexShrink: 0
                                }}>
                                  <div style={{
                                    fontWeight: '600',
                                    marginBottom: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {project.name}
                                  </div>
                                  <div style={{
                                    fontSize: '10px',
                                    color: '#999',
                                    fontStyle: 'italic'
                                  }}>
                                    {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
                                  </div>
                                </div>

                                {/* Timeline Bar Column */}
                                <div style={{
                                  position: 'relative',
                                  height: '40px',
                                  flex: 1,
                                  marginLeft: '24px',
                                  borderLeft: '1px solid #e5e5e0'
                                }}>
                                  {/* Background Grid Lines */}
                                  {months.map((month, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        position: 'absolute',
                                        left: `${month.offsetPercent}%`,
                                        top: 0,
                                        bottom: 0,
                                        width: '1px',
                                        backgroundColor: '#e5e5e0',
                                        opacity: 0.5
                                      }}
                                    />
                                  ))}

                                  {/* Project Bar with Arrow Style and Completion */}
                                  {(() => {
                                    // Calculate average completion percentage (excluding cancelled tasks - status 3)
                                    const activeTasks = project.tasks.filter(t => t.status !== 3);
                                    const avgCompletion = activeTasks.length > 0
                                      ? activeTasks.reduce((sum, t) => sum + (t.percentComplete || 0), 0) / activeTasks.length
                                      : 0;
                                    const completionPercent = Math.round(avgCompletion);

                                    return (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: `${leftPercent}%`,
                                          width: `${widthPercent}%`,
                                          height: '36px',
                                          top: '2px',
                                          backgroundColor: '#d1cdc7', // Light grey for incomplete portion
                                          border: '2px solid #ffffff',
                                          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)',
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                          zIndex: 50,
                                          overflow: 'hidden'
                                        }}
                                        title={`${project.name}\n${project.startDate!.toLocaleDateString()} - ${project.endDate!.toLocaleDateString()}\n${project.taskCount} tasks\n${completionPercent}% complete`}
                                      >
                                        {/* Completed portion overlay */}
                                        <div style={{
                                          position: 'absolute',
                                          left: 0,
                                          top: 0,
                                          bottom: 0,
                                          width: `${completionPercent}%`,
                                          backgroundColor: '#9c8e74', // Dark grey for completed portion
                                          transition: 'width 0.3s ease'
                                        }} />

                                        {/* Text content */}
                                        <span style={{
                                          position: 'relative',
                                          zIndex: 1,
                                          display: 'flex',
                                          alignItems: 'center',
                                          height: '100%',
                                          padding: '0 14px',
                                          fontSize: '12px',
                                          color: '#ffffff',
                                          fontWeight: '600',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {project.startDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {project.endDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {/* Milestone Markers */}
                                  {showMilestones && (() => {
                                    // Get filtered milestones and sort by date
                                    const filteredMilestones = project.tasks
                                      .filter(task => task.taskType === 1) // Only milestones
                                      .filter(task => milestoneFilter === 'all' || task.category === milestoneFilter || task.category === undefined) // Filter by category, include undefined
                                      .filter(task => task.startDate) // Must have a date
                                      .map(task => {
                                        const milestoneMs = task.startDate!.getTime() - minDate.getTime();
                                        const milestonePercent = (milestoneMs / timelineSpanMs) * 100;
                                        return { task, milestonePercent };
                                      })
                                      .filter(m => m.milestonePercent >= -10 && m.milestonePercent <= 110) // Show milestones slightly outside visible range
                                      .sort((a, b) => a.milestonePercent - b.milestonePercent);

                                    return filteredMilestones.map((milestone, mIdx) => {
                                      // Ensure category defaults to 0 if undefined
                                      const category = milestone.task.category !== undefined ? milestone.task.category : 0;
                                      const milestoneColor = getMilestoneColor(category);

                                      // Stagger milestones vertically if they're close together (within 2% of timeline)
                                      let verticalOffset = 0;
                                      if (mIdx > 0) {
                                        const prevPercent = filteredMilestones[mIdx - 1].milestonePercent;
                                        if (Math.abs(milestone.milestonePercent - prevPercent) < 2) {
                                          verticalOffset = 14 * (mIdx % 3 - 1); // -14px, 0px, or +14px
                                        }
                                      }

                                      return (
                                        <div
                                          key={`milestone-${project.id}-${milestone.task.id}-${mIdx}`}
                                          style={{
                                            position: 'absolute',
                                            left: `${milestone.milestonePercent}%`,
                                            top: `calc(50% + ${verticalOffset}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 110 + mIdx
                                          }}
                                          title={`${milestone.task.title}\nCategory: ${getCategoryLabel(category)}\nDate: ${milestone.task.startDate?.toLocaleDateString()}`}
                                        >
                                          <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 22 22"
                                            style={{
                                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                                            }}
                                          >
                                            <polygon
                                              points="11,1 21,11 11,21 1,11"
                                              fill={milestoneColor}
                                              stroke="#ffffff"
                                              strokeWidth="2"
                                            />
                                          </svg>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
      </div>

    </div>
  );
};