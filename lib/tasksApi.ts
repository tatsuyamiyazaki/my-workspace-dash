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

export const fetchTasks = async (accessToken: string, taskListId: string = '@default'): Promise<Task[]> => {
  const params = new URLSearchParams({
    showCompleted: 'false',
    showHidden: 'false',
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
