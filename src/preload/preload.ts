import { contextBridge, ipcRenderer } from 'electron';

type PetMenuCommand =
  | 'toggle-study'
  | 'back-to-idle'
  | 'start-focus-25-timer'
  | 'start-focus-45-timer'
  | 'start-break-5-timer'
  | 'start-break-10-timer'
  | 'open-custom-focus-timer'
  | 'toggle-focus-timer-pause'
  | 'end-focus-timer';
type FocusTimerBaseMode = import('../shared/focusTimer').FocusTimerBaseMode;
type FocusTimerPreferences = import('../shared/focusTimer').FocusTimerPreferences;
type FocusStats = import('../shared/focusTimer').FocusStats;
type FocusTimerState = import('../shared/focusTimer').FocusTimerState;
type FocusTimerNotificationKind = import('../shared/focusTimer').FocusTimerNotificationKind;

contextBridge.exposeInMainWorld('desktopPet', {
  startDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-start', position);
  },
  moveDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-move', position);
  },
  endDrag: () => {
    ipcRenderer.send('pet-drag-end');
  },
  setStudyMode: (isStudyMode: boolean) => {
    ipcRenderer.send('pet-study-mode-changed', isStudyMode);
  },
  getWindowVisibility: () => {
    return ipcRenderer.invoke('pet-get-window-visibility') as Promise<boolean>;
  },
  getActivePetId: () => {
    return ipcRenderer.invoke('pet-get-active-pet-id') as Promise<string>;
  },
  setActivePetId: (petId: string) => {
    ipcRenderer.send('pet-set-active-pet-id', petId);
  },
  onActivePetChanged: (callback: (petId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, petId: string) => {
      callback(petId);
    };

    ipcRenderer.on('pet-active-pet-changed', listener);

    return () => {
      ipcRenderer.removeListener('pet-active-pet-changed', listener);
    };
  },
  getFocusTimerState: () => {
    return ipcRenderer.invoke('pet-get-focus-timer-state') as Promise<FocusTimerState>;
  },
  getFocusTimerPreferences: () => {
    return ipcRenderer.invoke('pet-get-focus-timer-preferences') as Promise<FocusTimerPreferences>;
  },
  setFocusTimerPreferences: (preferences: FocusTimerPreferences) => {
    ipcRenderer.send('pet-set-focus-timer-preferences', preferences);
  },
  onFocusTimerPreferencesChanged: (callback: (preferences: FocusTimerPreferences) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, preferences: FocusTimerPreferences) => {
      callback(preferences);
    };

    ipcRenderer.on('pet-focus-timer-preferences-changed', listener);

    return () => {
      ipcRenderer.removeListener('pet-focus-timer-preferences-changed', listener);
    };
  },
  setFocusTimerState: (timerState: FocusTimerState) => {
    ipcRenderer.send('pet-set-focus-timer-state', timerState);
  },
  getFocusStats: () => {
    return ipcRenderer.invoke('pet-get-focus-stats') as Promise<FocusStats>;
  },
  onFocusStatsChanged: (callback: (stats: FocusStats) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, stats: FocusStats) => {
      callback(stats);
    };

    ipcRenderer.on('pet-focus-stats-changed', listener);

    return () => {
      ipcRenderer.removeListener('pet-focus-stats-changed', listener);
    };
  },
  showFocusTimerNotification: (kind: FocusTimerNotificationKind) => {
    ipcRenderer.send('pet-show-focus-timer-notification', kind);
  },
  recordCompletedTimer: (mode: FocusTimerBaseMode, durationMs: number) => {
    ipcRenderer.send('pet-record-completed-timer', mode, durationMs);
  },
  onWindowVisibility: (callback: (isVisible: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isVisible: boolean) => {
      callback(isVisible);
    };

    ipcRenderer.on('pet-window-visibility-changed', listener);

    return () => {
      ipcRenderer.removeListener('pet-window-visibility-changed', listener);
    };
  },
  onMenuCommand: (callback: (command: PetMenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: PetMenuCommand) => {
      callback(command);
    };

    ipcRenderer.on('pet-menu-command', listener);

    return () => {
      ipcRenderer.removeListener('pet-menu-command', listener);
    };
  }
});
