import { ReactNode, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery
} from '@mui/material';

// Define custom theme types
declare module '@mui/material/styles' {
  interface Theme {
    templates: {
      page_wrap: {
        maxWidth: string;
        margin: string;
        boxSizing: string;
        padding: string | number;
      };
      subheading: {
        textTransform: string;
        letterSpacing: string;
        fontWeight: string;
      };
      boxOfChips: {
        display: string;
        justifyContent: string;
        flexWrap: string;
        gap: string | number;
      };
      chip: (props: { size: number; backgroundColor: string }) => {
        height: string | number;
        minHeight: string | number;
        backgroundColor: string;
        borderRadius: string;
        padding: string | number;
        margin: string | number;
      };
    }
  }
  interface ThemeOptions {
    templates?: {
      page_wrap?: {
        maxWidth?: string;
        margin?: string;
        boxSizing?: string;
        padding?: string | number;
      };
      subheading?: {
        textTransform?: string;
        letterSpacing?: string;
        fontWeight?: string;
      };
      boxOfChips?: {
        display?: string;
        justifyContent?: string;
        flexWrap?: string;
        gap?: string | number;
      };
      chip?: (props: { size: number; backgroundColor: string }) => {
        height?: string | number;
        minHeight?: string | number;
        backgroundColor?: string;
        borderRadius?: string;
        padding?: string | number;
        margin?: string | number;
      };
    }
  }
}

const backgroundImage = "https://images.pexels.com/photos/18857526/pexels-photo-18857526/free-photo-of-larch-heaven.jpeg";

interface ThemeProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: ThemeProps) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(() => {
    const mode = prefersDarkMode ? 'dark' : 'light';
    
    return createTheme({
      palette: {
        mode,
        ...(mode === 'light' ? {
          primary: {
            main: '#1B365D', // Navy
          },
          secondary: {
            main: '#2C5282', // Teal
          },
          background: {
            default: '#FFFFFF',
            paper: '#F6F6F6',
          },
          text: {
            primary: '#4A4A4A', // Dark Gray
            secondary: '#4A5568', // Gray
          }
        } : {
          primary: {
            main: '#FFFFFF',
          },
          secondary: {
            main: '#2C5282', // Keep teal for dark mode accents
          },
          background: {
            default: '#1D2125',
            paper: '#1D2125',
          },
          text: {
            primary: '#FFFFFF',
            secondary: '#4A5568', // Gray
          }
        })
      },
      typography: {
        fontFamily: '"Helvetica", "Arial", sans-serif',
        h1: {
          fontWeight: 700,
          fontSize: '2.5rem',
          '@media (max-width:900px)': {
            fontSize: '1.8rem',
          },
        },
        h2: {
          fontWeight: 700,
          fontSize: '1.7rem',
          '@media (max-width:900px)': {
            fontSize: '1.6rem',
          },
        },
        h3: {
          fontSize: '1.4rem',
        },
        h4: {
          fontSize: '1.25rem',
        },
        h5: {
          fontSize: '1.1rem',
        },
        h6: {
          fontSize: '1rem',
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: mode === 'light' ? '#FFFFFF' : '#1D2125',
              backgroundImage: mode === 'light' 
                ? `linear-gradient(45deg, rgba(27, 54, 93, 0.05), rgba(44, 82, 130, 0.05))`
                : `linear-gradient(45deg, rgba(27, 54, 93, 0.1), rgba(44, 82, 130, 0.1))`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 8,
              '&.MuiButton-contained': {
                backgroundColor: mode === 'light' ? '#1B365D' : '#FFFFFF',
                color: mode === 'light' ? '#FFFFFF' : '#1B365D',
                '&:hover': {
                  backgroundColor: mode === 'light' ? '#2C5282' : '#F6F6F6',
                }
              },
              '&.MuiButton-outlined': {
                borderColor: mode === 'light' ? '#1B365D' : '#FFFFFF',
                color: mode === 'light' ? '#1B365D' : '#FFFFFF',
                '&:hover': {
                  backgroundColor: mode === 'light' ? 'rgba(27, 54, 93, 0.04)' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: mode === 'light' ? '#2C5282' : '#F6F6F6',
                }
              }
            }
          }
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: mode === 'light' ? '#FFFFFF' : '#1D2125',
            }
          }
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: mode === 'light' ? '#1B365D' : '#1D2125',
              color: mode === 'light' ? '#FFFFFF' : '#FFFFFF',
            }
          }
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              border: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)'}`,
            }
          }
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 8,
            }
          }
        }
      },
      shape: {
        borderRadius: 8
      },
      templates: {
        page_wrap: {
          maxWidth: 'min(1440px, 100vw)',
          margin: 'auto',
          boxSizing: 'border-box',
          padding: '56px',
        },
        subheading: {
          textTransform: 'uppercase',
          letterSpacing: '6px',
          fontWeight: '700',
        },
        boxOfChips: {
          display: 'flex',
          justifyContent: 'left',
          flexWrap: 'wrap',
          gap: '8px',
        },
        chip: ({ size, backgroundColor }) => ({
          height: `${size * 32}px`,
          minHeight: `${size * 32}px`,
          backgroundColor: backgroundColor || 'transparent',
          borderRadius: '16px',
          padding: '8px',
          margin: '4px'
        })
      },
      spacing: 8,
    });
  }, [prefersDarkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
