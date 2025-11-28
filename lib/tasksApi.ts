export interface Task {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
  notes?: string;
  taskListId?: string; // Added for UI tracking
}

export interface TaskList {
  id: string;
  title: string;
}

export const fetchTaskLists = async (accessToken: string): Promise<TaskList[]> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API List Error: ${res.status}`, errorBody);
    throw new Error(`Failed to fetch task lists: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
};

export const fetchTasks = async (accessToken: string, taskListId: string = '@default', showCompleted: boolean = false): Promise<Task[]> => {
  const params = new URLSearchParams({
    showCompleted: showCompleted.toString(),
    showHidden: showCompleted.toString(),
  });

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Tasks Error: ${res.status}`, errorBody);
    throw new Error(`Failed to fetch tasks: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
};

// Fetch all tasks from all lists (with completed tasks option)
export const fetchAllTasks = async (accessToken: string, showCompleted: boolean = true): Promise<{ tasks: Task[], taskLists: TaskList[] }> => {
  // 1. Fetch all task lists
  const taskLists = await fetchTaskLists(accessToken);

  // 2. Fetch tasks from all lists
  const allTasksPromises = taskLists.map(async (list) => {
    const listTasks = await fetchTasks(accessToken, list.id, showCompleted);
    return listTasks.map(t => ({ ...t, taskListId: list.id }));
  });

  const results = await Promise.all(allTasksPromises);
  const tasks = results.flat();

  return { tasks, taskLists };
};

export const createTask = async (accessToken: string, taskListId: string = '@default', task: Partial<Task>) => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Create Error: ${res.status}`, errorBody);
    throw new Error(`Failed to create task: ${res.status}`);
  }

  return await res.json();
};

export const updateTask = async (accessToken: string, taskListId: string = '@default', taskId: string, task: Partial<Task>) => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Update Error: ${res.status}`, errorBody);
    throw new Error(`Failed to update task: ${res.status}`);
  }

  return await res.json();
};

export const deleteTask = async (accessToken: string, taskListId: string = '@default', taskId: string) => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Delete Error: ${res.status}`, errorBody);
    throw new Error(`Failed to delete task: ${res.status}`);
  }
};

// Task List CRUD operations
export const createTaskList = async (accessToken: string, title: string): Promise<TaskList> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Create List Error: ${res.status}`, errorBody);
    throw new Error(`Failed to create task list: ${res.status}`);
  }

  return await res.json();
};

export const updateTaskList = async (accessToken: string, taskListId: string, title: string): Promise<TaskList> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${taskListId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Update List Error: ${res.status}`, errorBody);
    throw new Error(`Failed to update task list: ${res.status}`);
  }

  return await res.json();
};

export const deleteTaskList = async (accessToken: string, taskListId: string): Promise<void> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${taskListId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Tasks API Delete List Error: ${res.status}`, errorBody);
    throw new Error(`Failed to delete task list: ${res.status}`);
  }
};
