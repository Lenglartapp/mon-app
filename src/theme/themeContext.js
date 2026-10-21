import { createContext, useContext } from 'react';

export const ThemeModeContext = createContext({ mode: 'light', resolved: 'light', setMode: () => {} });
export const useThemeMode = () => useContext(ThemeModeContext);
