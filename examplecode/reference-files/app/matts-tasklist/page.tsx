"use client"; // Required for interactive components in Next.js
import "./css/styles.css";
import { useState } from "react";
import "../globals.css"; // Ensures global styles still load

type FilterType = 'all' | 'active' | 'completed';

interface Task {
  text: string;
  completed: boolean;
}

export default function MattsTaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<FilterType>('all');

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { text: newTask.trim(), completed: false }]);
      setNewTask("");
    }
  };

  const toggleTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks[index].completed = !newTasks[index].completed;
    setTasks(newTasks);
  };

  const deleteTask = (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };

  const clearCompletedTasks = () => {
    setTasks(tasks.filter(task => !task.completed));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      setTasks([...tasks, { text: newTask, completed: false }]);
      setNewTask("");
    }
  };

  const getFilteredTasks = () => {
    switch (filter) {
      case 'active':
        return tasks.filter(task => !task.completed);
      case 'completed':
        return tasks.filter(task => task.completed);
      default:
        return tasks;
    }
  };

  return (
    <div className="app-container">
      <div className="wave-container">
        {[1, 2, 3].map((i) => <div key={i} className="wave" />)}
      </div>
      <h1>Task List Manager</h1>
      <div className="container">
        <div className="input-group">
          <input
            type="text"
            placeholder="What needs to be done?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={addTask} className="add-btn">
            <span className="btn-text">Add Task</span>
            <span className="btn-icon">+</span>
          </button>
        </div>

        <div className="filters">
          {(['all', 'active', 'completed'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`filter-btn ${filter === type ? 'active' : ''}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="task-list">
        {getFilteredTasks().length === 0 ? (
          <div className="empty-message">No tasks yet. Add a task to get started!</div>
        ) : tasks.map((task, index) => (
          <div key={index} className="task-item">
            <div className="task-content">
              <div
                className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                onClick={() => toggleTask(index)}
              />
              <span className={`task-text ${task.completed ? 'completed' : ''}`}>
                {task.text}
              </span>
            </div>
            <div className="task-actions">
              <button
                className="remove-btn"
                onClick={() => deleteTask(index)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        </div>

        <div className="task-stats">
          <span className="task-count">{tasks.length} tasks total • {tasks.filter(t => t.completed).length} completed</span>
          {tasks.some(t => t.completed) && <button className="clear-btn" onClick={clearCompletedTasks}>Clear Completed</button>}
        </div>
      </div>
      <footer>
        <p>Created with ❤️ by Matt</p>
      </footer>
    </div>
  );
}