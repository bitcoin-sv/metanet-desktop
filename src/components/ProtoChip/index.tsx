import { useState, useEffect } from 'react'
import { Chip, Badge, Tooltip, Avatar, Stack } from '@mui/material'
import { withRouter, RouteComponentProps } from 'react-router-dom'
import CloseIcon from '@mui/icons-material/Close'
import DataObject from '@mui/icons-material/DataObject'
import makeStyles from '@mui/styles/makeStyles'
import { useTheme } from '@mui/styles'
import style from './style'
import { deterministicImage } from '../../utils/deterministicImage'
import CounterpartyChip from '../CounterpartyChip/index'
import PlaceholderAvatar from '../PlaceholderAvatar'

const useStyles = makeStyles(style as any, {
  name: 'ProtoChip'
})

interface ProtoChipProps extends RouteComponentProps {
  securityLevel: number
  protocolID: string
  counterparty?: string
  lastAccessed?: string
  originator?: string
  clickable?: boolean
  size?: number
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  expires?: string
  onCloseClick?: () => void
  canRevoke?: boolean
  description?: string
  iconURL?: string
  backgroundColor?: string
}

const ProtoChip: React.FC<ProtoChipProps> = ({
  securityLevel,
  protocolID,
  counterparty,
  lastAccessed,
  originator,
  history,
  clickable = false,
  size = 1.3,
  onClick,
  expires,
  onCloseClick,
  canRevoke = true,
  description,
  iconURL,
  backgroundColor = 'transparent'
}) => {
  const classes = useStyles()
  const theme: any = useTheme()

  const navToProtocolDocumentation = (e: any) => {
    if (clickable) {
      if (typeof onClick === 'function') {
        onClick(e)
      } else {
        e.stopPropagation()
        history.push(`/dashboard/protocol/${encodeURIComponent(protocolID)}`)
      }
    }
  }

  // Validate protocolID before hooks
  if (typeof protocolID !== 'string') {
    console.error('ProtoChip: protocolID must be a string. Received:', protocolID)
    // Don't return null here to avoid conditional hook calls
  }

  const [protocolName, setProtocolName] = useState(protocolID)
  const [iconURLState, setIconURLState] = useState(iconURL || deterministicImage(protocolID))
  const [imageError, setImageError] = useState(false)
  const [documentationURL] = useState('https://projectbabbage.com')

  useEffect(() => {
    if (typeof protocolID === 'string') {
      // Update state if props change
      setProtocolName(protocolID)
      setIconURLState(iconURL || deterministicImage(protocolID))
    }
  }, [protocolID, iconURL])

  // Handle image loading events
  const handleImageLoad = () => {
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const securityLevelExplainer = (securityLevel: number) => {
    switch (securityLevel) {
      case 2:
        return 'only with this app and counterparty'
      case 1:
        return 'only with this app'
      case 0:
        return 'in general'
      default:
        return 'Unknown security level'
    }
  }

  // If protocolID is invalid, return null after hooks are defined
  if (typeof protocolID !== 'string') {
    return null
  }

  return (
    <Stack direction="row" alignItems="center" spacing={3}>
      <Chip
        style={theme.templates.chip({ size, backgroundColor })}
        avatar={
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Tooltip
                arrow
                title="Protocol (click to learn more)"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(documentationURL, '_blank')
                }}
              >
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText
                  }}
                >
                  <DataObject fontSize="small" />
                </Avatar>
              </Tooltip>
            }
          >
            {!imageError ? (
              <Avatar
                src={iconURLState}
                alt={protocolName}
                sx={{ 
                  width: size * 32, 
                  height: size * 32,
                  borderRadius: '4px',
                  marginRight: '0.5em'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <PlaceholderAvatar
                name={protocolName}
                size={size * 32}
                variant="square"
                sx={{ borderRadius: '4px', marginRight: '0.5em' }}
              />
            )}
          </Badge>
        }
        label={protocolName}
        onClick={navToProtocolDocumentation}
        onDelete={canRevoke ? onCloseClick : undefined}
        deleteIcon={canRevoke ? <CloseIcon /> : undefined}
      />
      {counterparty && <CounterpartyChip
        size={size * 0.8}
        counterparty={counterparty}
      />}
      {expires && (
        <Stack>{expires}</Stack>
      )}
      <Stack>
        {securityLevelExplainer(securityLevel)}
      </Stack>
    </Stack>
  )
}

export default withRouter(ProtoChip)
