import React, { useEffect, useState, useRef, useContext } from 'react'
import { Typography, TextField, LinearProgress, Paper, Box } from '@mui/material'
import Grid from '@mui/material/Grid2'
import { useTheme } from '@mui/styles'
import MetanetApp from '../../../components/MetanetApp'
import SearchIcon from '@mui/icons-material/Search'
import Fuse from 'fuse.js'
import { WalletContext } from '../../../WalletContext'

const Apps = () => {
  const theme = useTheme()
  const { recentApps } = useContext(WalletContext)
  const [filteredApps, setFilteredApps] = useState([])

  const [fuseInstance, setFuseInstance] = useState(null)
  const [search, setSearch] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  const inputRef = useRef(null)

  // Configure fuse to search by app name
  const options = {
    // shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    includeMatches: true,
    useExtendedSearch: true,
    keys: ['appName']
  }

  const handleSearchChange = async (e) => {
    const value = e.target.value
    setSearch(value)

    // Clear the filtered apps once the text box is empty (instead of searching for empty)
    if (value === '') {
      setFilteredApps(recentApps)
      return
    }
    // Search for a matching app by name
    if (fuseInstance) {
      const results = fuseInstance.search(value).map(match => match.item)
      setFilteredApps(results)
    }
  }

  // Support the search field expand animation
  const handleSearchFocus = () => {
    setIsExpanded(true)
  }
  const handleSearchBlur = () => {
    setIsExpanded(false)
  }
  const handleIconClick = () => {
    setIsExpanded(true)
    inputRef.current.focus()
  }


  useEffect(() => {
    const fuse = new Fuse(recentApps, options)
    setFuseInstance(fuse)
    setLoading(false)
  }, [recentApps])

  return (
    <Box sx={{ padding: theme.spacing(3), maxWidth: '800px', margin: '0 auto' }}>
      <Typography variant="h1" color="textPrimary" sx={{ mb: 2 }}>
        Applications
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
        Browse and manage your application permissions.
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <TextField
          variant="outlined"
          fullWidth
          value={search}
          onChange={handleSearchChange}
          placeholder="Search"
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          inputRef={inputRef}
          InputProps={{
            startAdornment: (
              <SearchIcon
                onClick={handleIconClick}
                sx={{ mr: 1, cursor: 'pointer' }}
              />
            ),
            sx: {
              height: '3em'
            }
          }}
          sx={{
            mt: 1,
            mb: 3,
            width: isExpanded ? 'calc(100%)' : '8em',
            transition: 'width 0.3s ease'
          }}
        />
      </Box>

      {(search === '' && recentApps.length > 3) && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Recent Applications
          </Typography>

          <Grid container spacing={2}>
            {recentApps.map((app) => (
              <Grid
                key={app.domain}
                sx={{ xs: 12, sm: 6, md: 3 }}
              >
                <MetanetApp
                  appName={app.appName}
                  iconImageUrl={app.appIconImageUrl}
                  domain={app.domain}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      { search !== '' && <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Search Results
        </Typography>

        {loading && <AppLogo size={50} rotate />}

        {(filteredApps.length === 0 && !loading) && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" color="textSecondary">
              None found
            </Typography>
          </Box>
        )}

        <Grid container spacing={2}>
          {filteredApps.map((app) => (
            <Grid
              key={app.domain}
              sx={{  xs: 12, sm: 6, md: 3 }}
            >
              <MetanetApp
                appName={app.appName}
                iconImageUrl={app.appIconImageUrl}
                domain={app.domain}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>}
    </Box>
  )
}

export default Apps
