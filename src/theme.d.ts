import '@mui/material/styles';
import React from 'react';

declare module '@mui/material/styles' {
  interface Theme {
    approvals: {
      protocol: string;
      basket: string;
      identity: string;
      renewal: string;
    };
    templates: {
      page_wrap: React.CSSProperties;
    };
  }
  
  // allow configuration using `createTheme`
  interface ThemeOptions {
    approvals?: {
      protocol?: string;
      basket?: string;
      identity?: string;
      renewal?: string;
    };
    templates?: {
      page_wrap?: React.CSSProperties;
    };
  }
}
