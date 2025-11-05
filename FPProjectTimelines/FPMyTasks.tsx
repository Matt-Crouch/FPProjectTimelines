import * as React from 'react';
import { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Clock, User, Search, Filter, Edit3, Plus, ChevronDown, ChevronUp, Activity, PlayCircle, CheckCircle2, XCircle, FolderOpen, Crown, AlertTriangle } from 'lucide-react';
import { IInputs } from './generated/ManifestTypes';
import { VERSION_INFO } from '../version';

interface IFPMyTasksProps {
  context: ComponentFramework.Context<IInputs>;
  width?: number;
  height?: number;
}

// Real Dataverse schema interfaces
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
  _cr725_projecttask_value?: string;  // This might be the old field name
  _cr725_taskref_value?: string;      // This seems to be the actual field name in use
  _cr725_resource_value: string;
  cr725_resource?: {
    systemuserid: string;
    fullname: string;
    internalemailaddress?: string;
  };
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

// UI-friendly interfaces
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: Date;
  endDate?: Date;
  assignedUserId: string;
  assignedUserName: string;
  projectId: string;
  projectName: string;
  percentComplete?: number;
  createdOn: Date;
}

interface Project {
  id: string;
  name: string;
  projectNumber?: string;
  department?: string;
  site?: string;
  status?: string;
  tasks: Task[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  ownerId?: string;
  ownerName?: string;
  isOwner?: boolean;
}

interface CurrentUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
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

// Data transformation functions
const transformDataverseTask = (dvTask: DataverseTask): Task => ({
  id: dvTask.cr725_projecttasksid,
  title: dvTask.cr725_name,
  description: dvTask.cr725_note,
  status: dvTask.cr725_taskstate as TaskStatus,
  startDate: dvTask.cr725_startdate ? new Date(dvTask.cr725_startdate) : undefined,
  endDate: dvTask.cr725_enddate ? new Date(dvTask.cr725_enddate) : undefined,
  // assignedUserId and assignedUserName will be set in fetchUserTasks from resource assignments
  assignedUserId: '',
  assignedUserName: '',
  projectId: dvTask._cr725_relatedproject_value,
  projectName: dvTask.cr725_RelatedProject?.cr725_title || 'Unknown Project',
  percentComplete: dvTask.cr725_percentdone,
  createdOn: new Date(dvTask.createdon)
});

const transformDataverseUser = (dvUser: DataverseUser): CurrentUser => ({
  id: dvUser.systemuserid,
  name: dvUser.fullname,
  firstName: dvUser.firstname,
  lastName: dvUser.lastname,
  email: dvUser.internalemailaddress
});

const groupTasksByProject = (tasks: Task[], currentUserId?: string): Project[] => {
  const projectMap = new Map<string, Project>();
  
  // Get stored project data if available
  const ownerMap = (window as unknown as Record<string, unknown>).__projectOwnerMap as Map<string, { ownerId: string, ownerName: string }>;
  const projectDataMap = (window as unknown as Record<string, unknown>).__projectDataMap as Map<string, { projectNumber?: string, title: string }>;
  
  tasks.forEach(task => {
    if (!projectMap.has(task.projectId)) {
      const project: Project = {
        id: task.projectId,
        name: task.projectName,
        tasks: [],
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        notStartedTasks: 0
      };
      
      // Add project number and owner info from stored maps
      if (projectDataMap?.has(task.projectId)) {
        const projectData = projectDataMap.get(task.projectId)!;
        project.projectNumber = projectData.projectNumber;
        if (projectData.projectNumber) {
          project.name = `${projectData.projectNumber} | ${projectData.title}`;
        }
      }
      
      if (ownerMap?.has(task.projectId)) {
        const ownerInfo = ownerMap.get(task.projectId)!;
        project.ownerId = ownerInfo.ownerId;
        project.ownerName = ownerInfo.ownerName;
        project.isOwner = currentUserId ? ownerInfo.ownerId === currentUserId : false;
      }
      
      projectMap.set(task.projectId, project);
    }
    
    const project = projectMap.get(task.projectId)!;
    project.tasks.push(task);
    project.totalTasks++;
    
    if (task.status === TaskStatus.WorkComplete) {
      project.completedTasks++;
    } else if (task.status === TaskStatus.InProgress) {
      project.inProgressTasks++;
    } else if (task.status === TaskStatus.NotStarted) {
      project.notStartedTasks++;
    }
  });
  
  return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Add CSS animation keyframes to the document
if (typeof document !== 'undefined' && !document.getElementById('fp-my-tasks-styles')) {
  const style = document.createElement('style');
  style.id = 'fp-my-tasks-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export const FPMyTasks: React.FC<IFPMyTasksProps> = ({ context, width, height }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<CurrentUser | null>(null);
  const [availableUsers, setAvailableUsers] = useState<CurrentUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    status?: TaskStatus;
    startDate?: string;
    endDate?: string;
    description?: string;
    percentComplete?: number;
  }>({});
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Mock data for development
  const mockData: Project[] = [
    {
      id: '1',
      name: 'Website Redesign',
      totalTasks: 2,
      completedTasks: 0,
      inProgressTasks: 1,
      notStartedTasks: 1,
      tasks: [
        {
          id: 't1',
          title: 'Design new homepage layout',
          description: 'Create wireframes and mockups for the new homepage design',
          status: TaskStatus.InProgress,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-02-01'),
          assignedUserId: 'user1',
          assignedUserName: 'Matthew',
          projectId: '1',
          projectName: 'Website Redesign',
          percentComplete: 65,
          createdOn: new Date('2024-01-10')
        },
        {
          id: 't2',
          title: 'Implement new navigation',
          status: TaskStatus.NotStarted,
          endDate: new Date('2024-02-15'),
          assignedUserId: 'user1',
          assignedUserName: 'Matthew',
          projectId: '1',
          projectName: 'Website Redesign',
          createdOn: new Date('2024-01-05')
        }
      ]
    },
    {
      id: '2',
      name: 'PowerApps Migration',
      totalTasks: 2,
      completedTasks: 1,
      inProgressTasks: 1,
      notStartedTasks: 0,
      tasks: [
        {
          id: 't3',
          title: 'Setup Dataverse tables',
          status: TaskStatus.WorkComplete,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-20'),
          assignedUserId: 'user1',
          assignedUserName: 'Matthew',
          projectId: '2',
          projectName: 'PowerApps Migration',
          percentComplete: 100,
          createdOn: new Date('2023-12-20')
        },
        {
          id: 't4',
          title: 'Build task management PCF',
          status: TaskStatus.InProgress,
          startDate: new Date('2024-01-20'),
          endDate: new Date('2024-02-10'),
          assignedUserId: 'user1',
          assignedUserName: 'Matthew',
          projectId: '2',
          projectName: 'PowerApps Migration',
          percentComplete: 30,
          createdOn: new Date('2024-01-15')
        }
      ]
    }
  ];

  useEffect(() => {
    initializeComponent();
  }, []);

  const getCurrentUser = async (): Promise<CurrentUser | null> => {
    try {
      // In test harness, webAPI might not be available, so use mock user
      if (!context.webAPI) {
        console.warn('WebAPI not available, using mock user for test harness');
        return {
          id: 'mock-user-id',
          name: 'Matthew (Test)',
          firstName: 'Matthew',
          lastName: 'User',
          email: 'matthew@test.com'
        };
      }
      
      // Try to get user ID from PCF context
      let userId = context.userSettings?.userId;
      console.log('Initial userId from context.userSettings:', userId);
      
      // If userId is in GUID format with brackets, clean it
      if (userId) {
        userId = userId.replace(/[{}]/g, '').toLowerCase();
        console.log('Cleaned userId:', userId);
      }
      
      if (!userId) {
        // Try alternative methods to get user info
        console.log('Trying alternative user identification methods...');
        
        // Method 1: Try to get from globalContext if available
        const xrm = (window as unknown as Record<string, unknown>).Xrm as Record<string, unknown> | undefined;
        const globalContext = xrm?.Utility as Record<string, unknown>;
        if (globalContext?.getGlobalContext) {
          const contextData = (globalContext.getGlobalContext as () => Record<string, unknown>)();
          userId = (contextData?.userSettings as Record<string, unknown>)?.userId as string;
          console.log('userId from globalContext:', userId);
        }
        
        // Method 2: Get current user's email and match against systemuser table
        if (!userId && context.userSettings?.userName) {
          const userEmail = context.userSettings.userName;
          console.log('User email from context:', userEmail);
          
          const userQuery = `?$select=systemuserid,fullname,firstname,lastname,internalemailaddress&$filter=internalemailaddress eq '${userEmail}' or domainname eq '${userEmail}'`;
          const userResults = await context.webAPI.retrieveMultipleRecords('systemuser', userQuery);
          
          if (userResults.entities.length > 0) {
            const user = userResults.entities[0];
            userId = user.systemuserid;
            console.log('Found user by email match:', userId);
            return transformDataverseUser(user as DataverseUser);
          }
        }
      }
      
      if (!userId) {
        console.error('Unable to determine current user ID');
        throw new Error('Unable to determine current user');
      }
      
      // Get user details
      const userQuery = `?$select=systemuserid,fullname,firstname,lastname,internalemailaddress`;
      const userResult = await context.webAPI.retrieveRecord('systemuser', userId, userQuery);
      console.log('User details retrieved:', userResult);
      
      return transformDataverseUser(userResult as DataverseUser);
    } catch (error) {
      console.error('Error getting current user:', error);
      // Return mock user as fallback
      return {
        id: 'error-fallback-user',
        name: 'Matthew (Error Fallback)',
        firstName: 'Matthew',
        lastName: 'User',
        email: 'matthew@error.com'
      };
    }
  };

  const searchUsers = async (searchTerm: string): Promise<CurrentUser[]> => {
    try {
      if (!context.webAPI || searchTerm.length < 2) {
        return [];
      }

      // Search users by first name, last name, or full name
      const usersQuery = `?$filter=isdisabled eq false and (contains(firstname,'${searchTerm}') or contains(lastname,'${searchTerm}') or contains(fullname,'${searchTerm}'))&$select=systemuserid,fullname,firstname,lastname,internalemailaddress&$top=20&$orderby=fullname`;
      const usersResult = await context.webAPI.retrieveMultipleRecords('systemuser', usersQuery);
      
      return usersResult.entities.map((dvUser: unknown) => {
        const dataverseUser = dvUser as DataverseUser;
        return transformDataverseUser(dataverseUser);
      });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const fetchUserTasks = async (userId: string): Promise<Task[]> => {
    try {
      // In test harness, webAPI might not be available, so use mock data
      if (!context.webAPI) {
        console.warn('WebAPI not available, using mock tasks for test harness');
        return mockData.flatMap(p => p.tasks);
      }
      
      console.log('Fetching tasks for user:', userId);
      
      // Step 1: Get resource assignments for the current user using correct field name
      console.log('Querying resource assignments with _cr725_resource_value...');
      const resourceAssignmentsQuery = `?$filter=_cr725_resource_value eq '${userId}'`;
      const resourceAssignments = await context.webAPI.retrieveMultipleRecords('cr725_resourceassignments', resourceAssignmentsQuery);
      
      console.log('Found', resourceAssignments.entities.length, 'resource assignments for user');
      
      if (resourceAssignments.entities.length === 0) {
        console.log('No resource assignments found for user');
        return [];
      }
      
      // Step 2: Extract task IDs from resource assignments using correct field name
      const taskIds = resourceAssignments.entities
        .map(ra => ra._cr725_taskref_value || ra._cr725_projecttask_value)
        .filter(id => id); // Remove any null/undefined IDs
      
      console.log('Found task IDs:', taskIds);
      
      if (taskIds.length === 0) {
        console.log('No valid task IDs found in resource assignments');
        return [];
      }
      
      // Step 3: Query tasks with project information including owner (lookup field)
      console.log('Fetching tasks and project details...');
      const tasksQuery = `?$filter=${taskIds.map(id => `cr725_projecttasksid eq '${id}'`).join(' or ')}&$expand=cr725_RelatedProject($select=cr725_bihub_ideasid,cr725_title,cr725_id,cr725_department,cr725_site,cr725_currentprojectstatus,_cr725_projectowner_value,cr725_projectclosed,statecode;$filter=cr725_projectclosed ne true and statecode eq 0)&$select=cr725_projecttasksid,cr725_name,cr725_note,cr725_taskstate,cr725_startdate,cr725_enddate,cr725_percentdone,_cr725_relatedproject_value,createdon`;
      
      const tasksResult = await context.webAPI.retrieveMultipleRecords('cr725_projecttasks', tasksQuery);
      
      console.log('Found', tasksResult.entities.length, 'tasks');
      
      // Step 3.5: Get ALL resource assignments for these tasks to find actual assignees
      console.log('Fetching resource assignments for tasks...');
      const allAssignmentsQuery = `?$filter=${taskIds.map(id => `_cr725_taskref_value eq '${id}'`).join(' or ')}&$select=cr725_resourceassignmentsid,_cr725_taskref_value,_cr725_resource_value`;
      const allAssignments = await context.webAPI.retrieveMultipleRecords('cr725_resourceassignments', allAssignmentsQuery);
      
      // Create a map of task ID to assigned resource
      const taskAssignmentMap = new Map<string, { userId: string, userName: string }>();
      
      // Get unique user IDs from assignments
      const userIds = new Set<string>();
      const taskToUserMap = new Map<string, string>();
      
      allAssignments.entities.forEach((assignment: unknown) => {
        const typedAssignment = assignment as DataverseResourceAssignment;
        const taskId = typedAssignment._cr725_taskref_value || typedAssignment._cr725_projecttask_value;
        const userId = typedAssignment._cr725_resource_value;
        if (taskId && userId) {
          userIds.add(userId);
          taskToUserMap.set(taskId, userId);
        }
      });
      
      // Fetch user details for all assigned users
      if (userIds.size > 0) {
        const userQuery = `?$filter=${Array.from(userIds).map(id => `systemuserid eq '${id}'`).join(' or ')}&$select=systemuserid,fullname,firstname,lastname`;
        const usersResult = await context.webAPI.retrieveMultipleRecords('systemuser', userQuery);
        
        // Create user map
        const userMap = new Map<string, DataverseUser>();
        usersResult.entities.forEach((user: unknown) => {
          const dvUser = user as DataverseUser;
          userMap.set(dvUser.systemuserid, dvUser);
        });
        
        // Now build the task assignment map
        taskToUserMap.forEach((userId, taskId) => {
          const user = userMap.get(userId);
          if (user) {
            taskAssignmentMap.set(taskId, {
              userId: user.systemuserid,
              userName: user.fullname
            });
          }
        });
      }
      
      // Step 4: Transform the data to our UI format and track project data
      const projectOwnerMap = new Map<string, { ownerId: string, ownerName: string }>();
      const projectDataMap = new Map<string, { projectNumber?: string, title: string }>();
      
      const tasks = tasksResult.entities.map((dvTask: unknown) => {
        const dataverseTask = dvTask as DataverseTask;
        const task = transformDataverseTask(dataverseTask);
        
        // Set user information from the actual resource assignment
        const assignment = taskAssignmentMap.get(task.id);
        if (assignment) {
          task.assignedUserId = assignment.userId;
          task.assignedUserName = assignment.userName;
        } else {
          // Fallback if no assignment found
          task.assignedUserId = userId;
          task.assignedUserName = selectedUser?.name || currentUser?.name || 'Unassigned';
        }
        
        // Track project information if available
        if (dataverseTask.cr725_RelatedProject) {
          const project = dataverseTask.cr725_RelatedProject as DataverseProject;
          
          // Store project owner info
          if (project._cr725_projectowner_value) {
            projectOwnerMap.set(task.projectId, {
              ownerId: project._cr725_projectowner_value,
              ownerName: 'Project Owner' // We'll need to fetch names separately if needed
            });
          }
          
          // Store project data (number and title)
          projectDataMap.set(task.projectId, {
            projectNumber: project.cr725_id,
            title: project.cr725_title
          });
        }
        
        return task;
      });
      
      // Store project data for later use
      (window as unknown as Record<string, unknown>).__projectOwnerMap = projectOwnerMap;
      (window as unknown as Record<string, unknown>).__projectDataMap = projectDataMap;
      
      // Filter out tasks that don't have an associated project (should be handled by expand filter but double-checking)
      const validTasks = tasks.filter(task => {
        // Check if task has a valid project relationship
        const hasValidProject = task.projectId && task.projectName;
        if (!hasValidProject) {
          console.log(`Filtering out task ${task.id} - no valid project relationship`);
        }
        return hasValidProject;
      });

      console.log('Transformed tasks:', validTasks);
      console.log('Project owner map:', projectOwnerMap);
      return validTasks;
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Return empty array instead of mock data in production
      return [];
    }
  };

  const initializeComponent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Unable to identify current user');
      }
      
      setCurrentUser(user);
      setSelectedUser(user); // Default to current user
      setUserSearchTerm(user.name); // Initialize search with current user name
      
      // Fetch user's tasks
      const tasks = await fetchUserTasks(user.id);
      setAllTasks(tasks);
      
      // Group tasks by project and add owner information - use user.id for project owner comparison
      const groupedProjects = groupTasksByProject(tasks, user.id);
      
      // Add owner information and project numbers from stored map
      const ownerMap = (window as unknown as Record<string, unknown>).__projectOwnerMap as Map<string, { ownerId: string, ownerName: string }>;
      const projectDataMap = (window as unknown as Record<string, unknown>).__projectDataMap as Map<string, { projectNumber?: string, title: string }>;
      
      if (ownerMap && projectDataMap) {
        groupedProjects.forEach(project => {
          const ownerInfo = ownerMap.get(project.id);
          if (ownerInfo) {
            project.ownerId = ownerInfo.ownerId;
            project.ownerName = ownerInfo.ownerName;
            project.isOwner = ownerInfo.ownerId === user.id;
          }
          
          const projectData = projectDataMap.get(project.id);
          if (projectData) {
            project.projectNumber = projectData.projectNumber;
            // Update display name with project number
            if (projectData.projectNumber) {
              project.name = `${projectData.projectNumber} | ${projectData.title}`;
            }
          }
        });
      }
      
      setProjects(groupedProjects);
      
    } catch (error) {
      console.error('Error initializing component:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
      
      // Always provide fallback data to ensure component renders
      console.warn('Using fallback mock data due to initialization error');
      setCurrentUser({
        id: 'fallback-user',
        name: 'Matthew (Fallback)',
        firstName: 'Matthew',
        lastName: 'User',
        email: 'matthew@fallback.com'
      });
      const mockTasks = mockData.flatMap(p => p.tasks);
      setAllTasks(mockTasks);
      setProjects(mockData);
    } finally {
      setLoading(false);
    }
  };

  const getTotalTasks = () => {
    return projects.reduce((total, project) => total + project.tasks.length, 0);
  };

  const getOpenTasks = () => {
    return allTasks.filter(task => 
      task.status !== TaskStatus.WorkComplete && task.status !== TaskStatus.Cancelled
    ).length;
  };

  const getCompletedTasks = () => {
    return allTasks.filter(task => task.status === TaskStatus.WorkComplete).length;
  };

  const getCompletionPercentage = () => {
    const total = allTasks.length;
    if (total === 0) return 0;
    
    // Calculate weighted completion based on percentage complete
    const totalCompletion = allTasks.reduce((sum, task) => {
      return sum + (task.percentComplete || 0);
    }, 0);
    
    return Math.round(totalCompletion / total);
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const collapseAllProjects = () => {
    const allProjectIds = new Set(projects.map(p => p.id));
    setCollapsedProjects(allProjectIds);
  };

  const expandAllProjects = () => {
    setCollapsedProjects(new Set());
  };

  const areAllProjectsCollapsed = () => {
    return projects.length > 0 && collapsedProjects.size === projects.length;
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-hide after 3 seconds
  };

  const isTaskOverdue = (task: Task): boolean => {
    if (task.status === TaskStatus.WorkComplete) return false;
    
    const today = new Date();
    const isNotStartedPastStart = task.status === TaskStatus.NotStarted && 
                                 task.startDate && 
                                 task.startDate < today;
    const isPastDueNotComplete = !!(task.endDate && 
                                   task.endDate < today);
    
    return isNotStartedPastStart || isPastDueNotComplete;
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    try {
      // Determine percentage based on target status
      let newPercentage = draggedTask.percentComplete || 0;
      if (targetStatus === TaskStatus.NotStarted) {
        newPercentage = 0;
      } else if (targetStatus === TaskStatus.InProgress) {
        newPercentage = newPercentage === 0 ? 50 : newPercentage; // Default to 50% if moving from 0%
      } else if (targetStatus === TaskStatus.WorkComplete) {
        newPercentage = 100;
      }

      const updateData: Record<string, unknown> = {
        cr725_taskstate: targetStatus,
        cr725_percentdone: newPercentage,
      };

      await context.webAPI.updateRecord('cr725_projecttasks', draggedTask.id, updateData);

      // Update local state
      const updatedTasks = allTasks.map(task => {
        if (task.id === draggedTask.id) {
          return {
            ...task,
            status: targetStatus,
            percentComplete: newPercentage
          };
        }
        return task;
      });

      setAllTasks(updatedTasks);
      setProjects(groupTasksByProject(updatedTasks));
      
      showToast(`Task moved to ${TaskStatusLabels[targetStatus]} (${newPercentage}%)`, 'success');
    } catch (error) {
      console.error('Error updating task status:', error);
      showToast('Failed to move task. Please try again.', 'error');
    }

    setDraggedTask(null);
  };

  const handleUserSearchChange = async (searchTerm: string) => {
    setUserSearchTerm(searchTerm);
    if (searchTerm.length >= 2) {
      const users = await searchUsers(searchTerm);
      setAvailableUsers(users);
      setShowUserDropdown(true);
    } else {
      setAvailableUsers([]);
      setShowUserDropdown(false);
    }
  };

  const handleUserSelection = async (user: CurrentUser) => {
    if (user.id !== selectedUser?.id) {
      setLoading(true);
      setSelectedUser(user);
      setUserSearchTerm(user.name);
      setShowUserDropdown(false);
      
      // Fetch tasks for the selected user
      const tasks = await fetchUserTasks(user.id);
      setAllTasks(tasks);
      
      // Group tasks by project - pass selectedUser.id for project owner comparison
      const groupedProjects = groupTasksByProject(tasks, user.id);
      
      // Add owner information
      const ownerMap = (window as unknown as Record<string, unknown>).__projectOwnerMap as Map<string, { ownerId: string, ownerName: string }>;
      const projectDataMap = (window as unknown as Record<string, unknown>).__projectDataMap as Map<string, { projectNumber?: string, title: string }>;
      
      if (ownerMap && projectDataMap) {
        groupedProjects.forEach(project => {
          const ownerInfo = ownerMap.get(project.id);
          if (ownerInfo) {
            project.ownerId = ownerInfo.ownerId;
            project.ownerName = ownerInfo.ownerName;
            project.isOwner = ownerInfo.ownerId === user.id;
          }
          
          const projectData = projectDataMap.get(project.id);
          if (projectData) {
            project.projectNumber = projectData.projectNumber;
            if (projectData.projectNumber) {
              project.name = `${projectData.projectNumber} | ${projectData.title}`;
            }
          }
        });
      }
      
      setProjects(groupedProjects);
      setLoading(false);
    }
  };

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  const getInitials = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length === 0) return '';
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };



  const getNotStartedTasks = () => {
    return allTasks.filter(task => task.status === TaskStatus.NotStarted).length;
  };

  const getInProgressTasks = () => {
    return allTasks.filter(task => task.status === TaskStatus.InProgress).length;
  };

  const getProjectsOwned = () => {
    return projects.filter(p => p.isOwner).length;
  };

  const getProjectsInvolved = () => {
    return projects.length;
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.WorkComplete: return '#dcfce7';
      case TaskStatus.InProgress: return '#dbeafe';
      case TaskStatus.NotStarted: return '#f3f4f6';
      case TaskStatus.Cancelled: return '#f1f5f9';
      default: return '#f3f4f6';
    }
  };

  const getStatusTextColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.WorkComplete: return '#166534';
      case TaskStatus.InProgress: return '#1e40af';
      case TaskStatus.NotStarted: return '#374151';
      case TaskStatus.Cancelled: return '#475569';
      default: return '#374151';
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updateData = {
        cr725_taskstate: newStatus
      };
      
      await context.webAPI.updateRecord('cr725_projecttasks', taskId, updateData);
      
      // Update local state
      const updatedTasks = allTasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      );
      setAllTasks(updatedTasks);
      setProjects(groupTasksByProject(updatedTasks));
      
    } catch (error) {
      console.error('Error updating task status:', error);
      // Could add a toast notification here
    }
  };

  const startEditTask = (task: Task) => {
    // Use composite key to ensure uniqueness: projectId-taskId
    const editKey = `${task.projectId}-${task.id}`;
    setEditingTask(editKey);
    setEditingValues({
      status: task.status,
      startDate: task.startDate ? task.startDate.toISOString().split('T')[0] : '',
      endDate: task.endDate ? task.endDate.toISOString().split('T')[0] : '',
      description: task.description || '',
      percentComplete: task.percentComplete || 0
    });
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setEditingValues({});
  };

  const saveTaskChanges = async (taskId: string) => {
    try {
      const updateData: Record<string, unknown> = {};
      
      // Auto-determine status based on percentage complete
      if (editingValues.percentComplete !== undefined) {
        updateData.cr725_percentdone = editingValues.percentComplete;
        
        // Auto-set status based on percentage
        if (editingValues.percentComplete >= 100) {
          updateData.cr725_taskstate = TaskStatus.WorkComplete;
        } else if (editingValues.percentComplete > 0) {
          updateData.cr725_taskstate = TaskStatus.InProgress;
        } else {
          updateData.cr725_taskstate = TaskStatus.NotStarted;
        }
      }
      
      if (editingValues.startDate) {
        updateData.cr725_startdate = editingValues.startDate;
      }
      if (editingValues.endDate) {
        updateData.cr725_enddate = editingValues.endDate;
      }
      
      await context.webAPI.updateRecord('cr725_projecttasks', taskId, updateData);
      
      // Update local state
      const updatedTasks = allTasks.map(task => {
        if (task.id === taskId) {
          const newStatus = editingValues.percentComplete !== undefined 
            ? (editingValues.percentComplete >= 100 
                ? TaskStatus.WorkComplete 
                : editingValues.percentComplete > 0 
                  ? TaskStatus.InProgress 
                  : TaskStatus.NotStarted)
            : task.status;
            
          return {
            ...task,
            status: newStatus,
            startDate: editingValues.startDate ? new Date(editingValues.startDate) : task.startDate,
            endDate: editingValues.endDate ? new Date(editingValues.endDate) : task.endDate,
            percentComplete: editingValues.percentComplete ?? task.percentComplete
          };
        }
        return task;
      });
      
      setAllTasks(updatedTasks);
      setProjects(groupTasksByProject(updatedTasks));
      setEditingTask(null);
      setEditingValues({});
      
      showToast('Task updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving task changes:', error);
      showToast('Failed to update task. Please try again.', 'error');
    }
  };

  // Filter and search functions
  const getFilteredTasks = () => {
    let filtered = allTasks;
    
    // Apply status filter
    if (selectedStatus !== 'all') {
      const statusValue = parseInt(selectedStatus) as TaskStatus;
      filtered = filtered.filter(task => task.status === statusValue);
    }
    
    // Apply project filter
    if (selectedProject !== 'all') {
      filtered = filtered.filter(task => task.projectId === selectedProject);
    }
    
    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.projectName.toLowerCase().includes(term)
      );
    }
    
    return groupTasksByProject(filtered);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}>
            <div style={styles.spinnerRing}></div>
          </div>
          <div style={styles.loadingText}>Loading tasks...</div>
        </div>
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorMessage}>
          <span style={{ color: '#dc2626', fontSize: '18px', marginBottom: '8px' }}>⚠️ Error</span>
          <p>{error}</p>
          <button onClick={() => initializeComponent()} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Initializing component...</div>
      </div>
    );
  }

  // Use filtered projects for display
  const displayProjects = getFilteredTasks();

  // CSS animation keyframes are defined inline with transform

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {/* User Greeting */}
        {currentUser && selectedUser && (
          <>
            <div style={styles.welcomeLine}>
              <span style={styles.hiText}>
                {selectedUser.id === currentUser.id 
                  ? `Hi ${getFirstName(currentUser.name)}! 👋` 
                  : `Showing Projects for ${selectedUser.name}`}
              </span>
              <div style={styles.headerRight}>
                <span style={styles.selectUserLabel}>Select User:</span>
                <div style={styles.userSearchContainer}>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => handleUserSearchChange(e.target.value)}
                    onFocus={() => userSearchTerm.length >= 2 && setShowUserDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                    style={styles.userSearchInput}
                  />
                  {showUserDropdown && availableUsers.length > 0 && (
                    <div style={styles.userDropdown}>
                      {availableUsers.map(user => (
                        <div 
                          key={user.id} 
                          style={styles.userDropdownItem}
                          onClick={() => handleUserSelection(user)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          {user.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUser.id !== currentUser.id && (
                  <button 
                    style={styles.clearButton}
                    onClick={() => {
                      handleUserSelection(currentUser);
                    }}
                  >
                    Clear
                  </button>
                )}
                <span style={styles.version}>{VERSION_INFO.getDisplayVersion()}</span>
              </div>
            </div>
            <div style={styles.subtitle}>
              {selectedUser.id === currentUser.id 
                ? `You have ${getOpenTasks()} open tasks across ${projects.length} Active Projects`
                : `${selectedUser.name} has ${getOpenTasks()} open tasks across ${projects.length} Active Projects`}
            </div>
          </>
        )}
      </div>


      {/* Summary Section with Chart and Tiles */}
      <div style={styles.summarySection}>
        {/* Left side - Charts */}
        <div style={styles.chartsContainer}>
          {/* Gauge Chart */}
          <div style={styles.gaugeContainer}>
            <h3 style={styles.gaugeTitle}>Total Work Completion</h3>
            <div style={styles.gaugeChart}>
            <svg width="200" height="240" viewBox="0 0 200 240">
              <circle
                cx="100"
                cy="120"
                r="70"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="120"
                r="70"
                fill="none"
                stroke="#16a34a"
                strokeWidth="12"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - getCompletionPercentage() / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 100 120)"
              />
              <text
                x="100"
                y="115"
                textAnchor="middle"
                dy="0.3em"
                fontSize="28"
                fontWeight="600"
                fill="#111827"
              >
                {getCompletionPercentage()}%
              </text>
              <text
                x="100"
                y="135"
                textAnchor="middle"
                fontSize="12"
                fill="#6b7280"
              >
                Complete
              </text>
            </svg>
          </div>
        </div>

        </div>
        
        {/* Right side - Summary Tiles */}
        <div style={styles.tilesContainer}>
          {/* Tasks Section */}
          <div style={styles.tilesSection}>
            <h3 style={styles.sectionTitle}>Tasks</h3>
            <div style={styles.sectionSeparator}></div>
            <div style={styles.tilesRow}>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <Activity size={18} color="#6b7280" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getTotalTasks()}</div>
                <div style={styles.tileLabel}>Total Active</div>
              </div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <XCircle size={18} color="#f97316" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getNotStartedTasks()}</div>
                <div style={styles.tileLabel}>Not Started</div>
              </div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <PlayCircle size={18} color="#3b82f6" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getInProgressTasks()}</div>
                <div style={styles.tileLabel}>In Progress</div>
              </div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getCompletedTasks()}</div>
                <div style={styles.tileLabel}>Complete</div>
              </div>
            </div>
            </div>
          </div>
          
          {/* Projects Section */}
          <div style={styles.tilesSection}>
            <h3 style={styles.sectionTitle}>Projects</h3>
            <div style={styles.sectionSeparator}></div>
            <div style={styles.tilesRow}>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <FolderOpen size={18} color="#8b5cf6" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getProjectsInvolved()}</div>
                <div style={styles.tileLabel}>Total Projects</div>
              </div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.tileIcon}>
                <Crown size={18} color="#f59e0b" />
              </div>
              <div style={styles.tileContent}>
                <div style={styles.tileNumber}>{getProjectsOwned()}</div>
                <div style={styles.tileLabel}>Projects I Own</div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersContainer}>
        <div style={styles.searchContainer}>
          <Search size={16} color="#6b7280" style={styles.searchIcon} />
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filtersRight}>
          <select 
            style={styles.filterSelect}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value={TaskStatus.NotStarted.toString()}>Not Started</option>
            <option value={TaskStatus.InProgress.toString()}>In Progress</option>
            <option value={TaskStatus.WorkComplete.toString()}>Completed</option>
            <option value={TaskStatus.Cancelled.toString()}>Cancelled</option>
          </select>

          <select 
            style={styles.filterSelect}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>

          <button 
            style={styles.collapseButton}
            onClick={areAllProjectsCollapsed() ? expandAllProjects : collapseAllProjects}
            title={areAllProjectsCollapsed() ? "Expand All Projects" : "Collapse All Projects"}
          >
            {areAllProjectsCollapsed() ? (
              <>
                <ChevronDown size={16} />
                Expand All
              </>
            ) : (
              <>
                <ChevronUp size={16} />
                Collapse All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Project Groups */}
      <div style={styles.projectsContainer}>
        {displayProjects.length === 0 ? (
          <div style={styles.noResultsContainer}>
            <p style={styles.noResultsText}>No tasks found matching your criteria.</p>
          </div>
        ) : (
          displayProjects.map(project => (
          <div key={project.id} style={styles.projectCard}>
            <div 
              style={{
                ...styles.projectHeader,
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => toggleProjectCollapse(project.id)}
            >
              <div style={styles.projectHeaderLeft}>
                {collapsedProjects.has(project.id) ? 
                  <ChevronDown size={20} color="#374151" /> : 
                  <ChevronUp size={20} color="#374151" />
                }
                <div style={styles.projectTitleContainer}>
                  {project.projectNumber && (
                    <span style={styles.projectId}>{project.projectNumber}</span>
                  )}
                  <h3 style={styles.projectTitle}>
                    {project.projectNumber ? project.name.split(' | ')[1] || project.name : project.name}
                  </h3>
                </div>
              </div>
              <div style={styles.projectHeaderRight}>
                <div style={styles.taskCount}>
                  {project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
                </div>
                {project.isOwner && (
                  <span style={styles.ownerBadge}>Owner</span>
                )}
              </div>
            </div>

            {!collapsedProjects.has(project.id) && (
              <div style={styles.kanbanContainer}>

                {/* Not Started Lane */}
                <div style={styles.kanbanLane}>
                  <div style={styles.kanbanHeader}>
                    <XCircle size={14} color="#ef4444" />
                    <span style={styles.kanbanTitle}>Not Started</span>
                    <span style={styles.kanbanCount}>
                      {project.tasks.filter(t => t.status === TaskStatus.NotStarted).length}
                    </span>
                  </div>
                  <div 
                    style={styles.kanbanCards}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, TaskStatus.NotStarted)}
                  >
                    {project.tasks
                      .filter(task => task.status === TaskStatus.NotStarted)
                      .map(task => {
                        const isEditing = editingTask === `${project.id}-${task.id}`;
                        const overdue = isTaskOverdue(task);
                        return (
                          <div 
                            key={task.id} 
                            style={{
                              ...styles.kanbanCard,
                              ...(overdue ? styles.overdueCard : {}),
                              position: 'relative'
                            }}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, task)}
                          >
                    <div style={styles.taskHeader}>
                      <div style={styles.taskTitleSection}>
                        <h4 style={styles.taskTitle}>{task.title}</h4>
                      </div>
                      
                      {!isEditing ? (
                        <button 
                          style={styles.editButton}
                          onClick={() => startEditTask(task)}
                        >
                          <Edit3 size={14} color="#6b7280" />
                        </button>
                      ) : (
                        <div style={styles.editActions}>
                          <button 
                            style={styles.saveButton}
                            onClick={() => saveTaskChanges(task.id)}
                          >
                            Save
                          </button>
                          <button 
                            style={styles.cancelButton}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={styles.editForm}>
                        <div style={styles.editRow}>
                          <label style={styles.editLabel}>Progress (%):</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            style={styles.editInput}
                            value={editingValues.percentComplete || 0}
                            onChange={(e) => {
                              const value = e?.target?.value;
                              setEditingValues(prev => ({ 
                                ...prev, 
                                percentComplete: value ? parseInt(value) || 0 : 0 
                              }));
                            }}
                          />
                          <span style={styles.percentLabel}>%</span>
                        </div>

                        <div style={styles.editRow}>
                          <label style={styles.editLabel}>Start Date:</label>
                          <input 
                            type="date"
                            style={styles.editInput}
                            value={editingValues.startDate || ''}
                            onChange={(e) => {
                              const value = e?.target?.value;
                              setEditingValues(prev => ({ 
                                ...prev, 
                                startDate: value || '' 
                              }));
                            }}
                          />
                        </div>

                        <div style={styles.editRow}>
                          <label style={styles.editLabel}>Due Date:</label>
                          <input 
                            type="date"
                            style={styles.editInput}
                            value={editingValues.endDate || ''}
                            onChange={(e) => {
                              const value = e?.target?.value;
                              setEditingValues(prev => ({ 
                                ...prev, 
                                endDate: value || '' 
                              }));
                            }}
                          />
                        </div>
                        
                        <div style={styles.statusHint}>
                          💡 Status auto-updates: 0% = Not Started, 1-99% = In Progress, 100% = Complete
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.taskDates}>
                          <span style={styles.fieldLabel}>Schedule: </span>
                          {task.startDate && (
                            <span>{task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {task.startDate && task.endDate && (
                            <span style={{ margin: '0 4px' }}>→</span>
                          )}
                          {task.endDate && (
                            <span>{task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {!task.startDate && !task.endDate && (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not scheduled</span>
                          )}
                        </div>

                        {task.percentComplete !== undefined && (
                          <div style={styles.progressSection}>
                            <span style={styles.fieldLabel}>Progress: </span>
                            <div style={styles.progressBar}>
                              <div 
                                style={{
                                  ...styles.progressFill,
                                  width: `${task.percentComplete}%`
                                }}
                              />
                            </div>
                            <span style={styles.progressText}>{task.percentComplete}%</span>
                          </div>
                        )}
                        
                        <div style={styles.taskFooter}>
                          <div style={styles.ownerSection}>
                            <div style={styles.avatarCircle}>
                              {getInitials(task.assignedUserName)}
                            </div>
                            <span style={styles.ownerName}>{task.assignedUserName}</span>
                          </div>
                          {overdue && (
                            <div style={styles.overdueBadgeSmall}>
                              <AlertTriangle size={10} />
                              OVERDUE
                            </div>
                          )}
                        </div>
                      </>
                    )}

                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* In Progress Lane */}
                <div style={styles.kanbanLane}>
                  <div style={styles.kanbanHeader}>
                    <PlayCircle size={14} color="#3b82f6" />
                    <span style={styles.kanbanTitle}>In Progress</span>
                    <span style={styles.kanbanCount}>
                      {project.tasks.filter(t => t.status === TaskStatus.InProgress).length}
                    </span>
                  </div>
                  <div 
                    style={styles.kanbanCards}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, TaskStatus.InProgress)}
                  >
                    {project.tasks
                      .filter(task => task.status === TaskStatus.InProgress)
                      .map(task => {
                        const isEditing = editingTask === `${project.id}-${task.id}`;
                        const overdue = isTaskOverdue(task);
                        return (
                          <div 
                            key={task.id} 
                            style={{
                              ...styles.kanbanCard,
                              ...(overdue ? styles.overdueCard : {}),
                              position: 'relative'
                            }}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, task)}
                          >
                            <div style={styles.taskHeader}>
                              <div style={styles.taskTitleSection}>
                                <h4 style={styles.taskTitle}>{task.title}</h4>
                              </div>
                              
                              {!isEditing ? (
                                <button 
                                  style={styles.editButton}
                                  onClick={() => startEditTask(task)}
                                >
                                  <Edit3 size={14} color="#6b7280" />
                                </button>
                              ) : (
                                <div style={styles.editActions}>
                                  <button 
                                    style={styles.saveButton}
                                    onClick={() => saveTaskChanges(task.id)}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    style={styles.cancelButton}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div style={styles.editForm}>
                                <div style={styles.editRow}>
                                  <label style={styles.editLabel}>Progress (%):</label>
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    style={styles.editInput}
                                    value={editingValues.percentComplete || 0}
                                    onChange={(e) => {
                                      const value = e?.target?.value;
                                      setEditingValues(prev => ({ 
                                        ...prev, 
                                        percentComplete: value ? parseInt(value) || 0 : 0 
                                      }));
                                    }}
                                  />
                                  <span style={styles.percentLabel}>%</span>
                                </div>

                                <div style={styles.editRow}>
                                  <label style={styles.editLabel}>Start Date:</label>
                                  <input 
                                    type="date"
                                    style={styles.editInput}
                                    value={editingValues.startDate || ''}
                                    onChange={(e) => {
                                      const value = e?.target?.value;
                                      setEditingValues(prev => ({ 
                                        ...prev, 
                                        startDate: value || '' 
                                      }));
                                    }}
                                  />
                                </div>

                                <div style={styles.editRow}>
                                  <label style={styles.editLabel}>Due Date:</label>
                                  <input 
                                    type="date"
                                    style={styles.editInput}
                                    value={editingValues.endDate || ''}
                                    onChange={(e) => {
                                      const value = e?.target?.value;
                                      setEditingValues(prev => ({ 
                                        ...prev, 
                                        endDate: value || '' 
                                      }));
                                    }}
                                  />
                                </div>
                                
                                <div style={styles.statusHint}>
                                  💡 Status auto-updates: 0% = Not Started, 1-99% = In Progress, 100% = Complete
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={styles.taskDates}>
                                  <span style={styles.fieldLabel}>Schedule: </span>
                                  {task.startDate && (
                                    <span>{task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  )}
                                  {task.startDate && task.endDate && (
                                    <span style={{ margin: '0 4px' }}>→</span>
                                  )}
                                  {task.endDate && (
                                    <span>{task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  )}
                                  {!task.startDate && !task.endDate && (
                                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not scheduled</span>
                                  )}
                                </div>

                                {task.percentComplete !== undefined && (
                                  <div style={styles.progressSection}>
                                    <span style={styles.fieldLabel}>Progress: </span>
                                    <div style={styles.progressBar}>
                                      <div 
                                        style={{
                                          ...styles.progressFill,
                                          width: `${task.percentComplete}%`
                                        }}
                                      />
                                    </div>
                                    <span style={styles.progressText}>{task.percentComplete}%</span>
                                  </div>
                                )}
                                
                                <div style={styles.taskFooter}>
                                  <div style={styles.ownerSection}>
                                    <div style={styles.avatarCircle}>
                                      {getInitials(task.assignedUserName)}
                                    </div>
                                    <span style={styles.ownerName}>{task.assignedUserName}</span>
                                  </div>
                                  {overdue && (
                                    <div style={styles.overdueBadgeSmall}>
                                      <AlertTriangle size={10} />
                                      OVERDUE
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Complete Lane */}
                <div style={styles.kanbanLane}>
                  <div style={styles.kanbanHeader}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span style={styles.kanbanTitle}>Complete</span>
                    <span style={styles.kanbanCount}>
                      {project.tasks.filter(t => t.status === TaskStatus.WorkComplete).length}
                    </span>
                  </div>
                  <div 
                    style={styles.kanbanCards}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, TaskStatus.WorkComplete)}
                  >
                    {project.tasks
                      .filter(task => task.status === TaskStatus.WorkComplete)
                      .map(task => {
                        const overdue = isTaskOverdue(task);
                        return (
                        <div 
                          key={task.id} 
                          style={{
                            ...styles.kanbanCard,
                            ...(overdue ? styles.overdueCard : {}),
                            position: 'relative'
                          }}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, task)}
                        >
                          <div style={styles.taskHeader}>
                            <div style={styles.taskTitleSection}>
                              <h4 style={styles.taskTitle}>{task.title}</h4>
                            </div>
                          </div>

                          <div style={styles.taskDates}>
                            <span style={styles.fieldLabel}>Schedule: </span>
                            {task.startDate && (
                              <span>{task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            )}
                            {task.startDate && task.endDate && (
                              <span style={{ margin: '0 4px' }}>→</span>
                            )}
                            {task.endDate && (
                              <span>{task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            )}
                            {!task.startDate && !task.endDate && (
                              <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not scheduled</span>
                            )}
                          </div>

                          {task.percentComplete !== undefined && (
                            <div style={styles.progressSection}>
                              <span style={styles.fieldLabel}>Progress: </span>
                              <div style={styles.progressBar}>
                                <div 
                                  style={{
                                    ...styles.progressFill,
                                    width: `${task.percentComplete}%`
                                  }}
                                />
                              </div>
                              <span style={styles.progressText}>{task.percentComplete}%</span>
                            </div>
                          )}
                          
                          <div style={styles.taskFooter}>
                            <div style={styles.ownerSection}>
                              <div style={styles.avatarCircle}>
                                {getInitials(task.assignedUserName)}
                              </div>
                              <span style={styles.ownerName}>{task.assignedUserName}</span>
                            </div>
                            {overdue && (
                              <div style={styles.overdueBadgeSmall}>
                                <AlertTriangle size={10} />
                                OVERDUE
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
          ))
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          ...styles.toastContainer,
          backgroundColor: toast.type === 'success' ? '#dcfce7' : '#fee2e2',
          borderColor: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: toast.type === 'success' ? '#166534' : '#dc2626',
        }}>
          <span style={styles.toastIcon}>
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span style={styles.toastMessage}>{toast.message}</span>
          <button 
            style={styles.toastClose}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`,
    width: '100%',
    height: '100%',
    backgroundColor: '#fafafa',
    padding: '24px',
    overflow: 'auto',
  } as React.CSSProperties,

  loadingContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: '100vh',
    paddingTop: '120px',
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`,
    backgroundColor: '#fafafa',
  } as React.CSSProperties,

  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  } as React.CSSProperties,

  loadingSpinner: {
    position: 'relative',
    width: '50px',
    height: '50px',
  } as React.CSSProperties,

  spinnerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
  loadingText: {
    color: '#6b7280',
    fontSize: '16px',
    fontWeight: '500',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`,
    padding: '24px',
  } as React.CSSProperties,

  errorMessage: {
    textAlign: 'center',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #fee2e2',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  } as React.CSSProperties,

  retryButton: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#374151',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  noResultsContainer: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,

  noResultsText: {
    color: '#6b7280',
    fontSize: '16px',
    margin: '0',
  } as React.CSSProperties,

  header: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,

  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  } as React.CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,

  title: {
    margin: '0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
  } as React.CSSProperties,

  version: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    padding: '4px 8px',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    marginLeft: 'auto',
  } as React.CSSProperties,

  greeting: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
    fontSize: '16px',
  } as React.CSSProperties,

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  } as React.CSSProperties,

  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  summaryIcon: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  } as React.CSSProperties,

  summaryContent: {
    flex: 1,
  } as React.CSSProperties,

  summaryNumber: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '4px',
  } as React.CSSProperties,

  summaryLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
  } as React.CSSProperties,

  filtersContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,

  searchContainer: {
    position: 'relative',
    width: '380px',
    minWidth: '280px',
  } as React.CSSProperties,

  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  } as React.CSSProperties,

  searchInput: {
    width: '100%',
    padding: '12px 20px 12px 48px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#374151',
    outline: 'none',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  filterSelect: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  projectsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  } as React.CSSProperties,

  projectCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  } as React.CSSProperties,

  projectHeader: {
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  projectTitle: {
    margin: '0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
  } as React.CSSProperties,

  taskCount: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
  } as React.CSSProperties,

  tasksContainer: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  } as React.CSSProperties,

  taskCard: {
    padding: '16px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,

  taskHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '4px',
  } as React.CSSProperties,

  taskTitleSection: {
    flex: 1,
  } as React.CSSProperties,

  taskTitle: {
    margin: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    lineHeight: '1.3',
  } as React.CSSProperties,

  taskDescription: {
    margin: '0',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.4',
  } as React.CSSProperties,

  editButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    opacity: 0.6,
    '&:hover': {
      opacity: 1,
      backgroundColor: '#f3f4f6',
    },
  } as React.CSSProperties,

  editActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  saveButton: {
    padding: '6px 12px',
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  cancelButton: {
    padding: '6px 12px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  editForm: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginTop: '12px',
  } as React.CSSProperties,

  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  editLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    minWidth: '80px',
  } as React.CSSProperties,

  editInput: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#374151',
    backgroundColor: 'white',
    minWidth: '120px',
    outline: 'none',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  editSelect: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#374151',
    backgroundColor: 'white',
    minWidth: '140px',
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,

  editTextarea: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#374151',
    backgroundColor: 'white',
    minWidth: '250px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  percentLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginLeft: '4px',
  } as React.CSSProperties,

  taskMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  } as React.CSSProperties,

  statusBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  priorityBadge: {
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  dueDateBadge: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,

  progressBadge: {
    fontSize: '12px',
    color: '#16a34a',
    fontWeight: '500',
  } as React.CSSProperties,

  taskComments: {
    fontSize: '13px',
    color: '#6b7280',
    fontStyle: 'italic',
  } as React.CSSProperties,

  taskOwner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #e5e7eb',
  } as React.CSSProperties,

  // New styles for enhancements
  welcomeMessage: {
    marginBottom: '8px',
  } as React.CSSProperties,

  hiText: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    fontWeight: '500',
  } as React.CSSProperties,

  summarySection: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '24px',
    marginBottom: '32px',
  } as React.CSSProperties,

  tilesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: '1',
    justifyContent: 'center',
    paddingLeft: '20px',
  } as React.CSSProperties,

  statsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } as React.CSSProperties,

  statsTitle: {
    margin: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  tilesRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  summaryTile: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '18px 22px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
    minWidth: '165px',
    height: '70px',
  } as React.CSSProperties,

  tileIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
  } as React.CSSProperties,

  tileContent: {
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  tileNumber: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    lineHeight: '1',
  } as React.CSSProperties,

  tileLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
    marginTop: '2px',
  } as React.CSSProperties,

  chartsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  gaugeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    minWidth: '240px',
    height: '100%',
    justifyContent: 'center',
  } as React.CSSProperties,

  gaugeTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  } as React.CSSProperties,

  gaugeChart: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  projectHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  projectTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  projectId: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  } as React.CSSProperties,

  projectHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,

  ownerBadge: {
    padding: '2px 8px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  welcomeLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  selectUserLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
  } as React.CSSProperties,
  clearButton: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151',
    cursor: 'pointer',
  } as React.CSSProperties,
  userSearchContainer: {
    position: 'relative',
  } as React.CSSProperties,
  userSearchInput: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: 'white',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    minWidth: '200px',
    outline: 'none',
  } as React.CSSProperties,
  userDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto',
  } as React.CSSProperties,
  userDropdownItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6',
  } as React.CSSProperties,

  kanbanContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#f9fafb',
  } as React.CSSProperties,

  kanbanLane: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '12px',
    minHeight: '200px',
  } as React.CSSProperties,

  kanbanHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e5e7eb',
  } as React.CSSProperties,

  kanbanTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    flex: '1',
  } as React.CSSProperties,

  kanbanCount: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    backgroundColor: 'white',
    padding: '2px 6px',
    borderRadius: '4px',
  } as React.CSSProperties,

  kanbanCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1',
  } as React.CSSProperties,

  kanbanCard: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    cursor: 'grab',
    transition: 'all 0.2s',
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,

  overdueCard: {
    borderColor: '#ef4444',
    borderWidth: '2px',
    backgroundColor: '#fef2f2',
    boxShadow: '0 1px 3px rgba(239, 68, 68, 0.2)',
  } as React.CSSProperties,


  filtersRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  } as React.CSSProperties,

  collapseButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#e5e7eb',
    },
  } as React.CSSProperties,

  statusHint: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  } as React.CSSProperties,

  toastContainer: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 9999,
    maxWidth: '400px',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  toastIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  toastMessage: {
    flex: 1,
  } as React.CSSProperties,

  toastClose: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'inherit',
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  } as React.CSSProperties,

  tilesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,

  sectionTitle: {
    margin: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  sectionSeparator: {
    height: '1px',
    backgroundColor: '#e5e7eb',
    marginBottom: '4px',
  } as React.CSSProperties,

  taskDates: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  } as React.CSSProperties,

  progressSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: 'auto',
  } as React.CSSProperties,

  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  } as React.CSSProperties,

  progressText: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#3b82f6',
  } as React.CSSProperties,

  taskFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '8px',
  } as React.CSSProperties,

  ownerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,

  avatarCircle: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '600',
    flexShrink: 0,
  } as React.CSSProperties,

  ownerName: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '120px',
  } as React.CSSProperties,

  overdueBadgeSmall: {
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '9px',
    fontWeight: '600',
    padding: '2px 4px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: '4px',
  } as React.CSSProperties,
};