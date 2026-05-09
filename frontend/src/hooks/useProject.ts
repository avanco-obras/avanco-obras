import { useCallback } from 'react';
import { useStore } from '../store';
import { projectsApi } from '../services/api';
import type { Project } from '../types';

export function useProject() {
  const { currentProject, setCurrentProject } = useStore();

  const loadProject = useCallback(async (id: string) => {
    const project = await projectsApi.get(id);
    setCurrentProject(project);
    return project;
  }, [setCurrentProject]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    const updated = await projectsApi.update(id, data);
    setCurrentProject(updated);
    return updated;
  }, [setCurrentProject]);

  return { currentProject, loadProject, updateProject, setCurrentProject };
}
