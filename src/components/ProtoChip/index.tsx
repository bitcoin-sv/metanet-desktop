import { useState } from 'react'
import { Grid, Chip, Badge, Avatar, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { withRouter, RouteComponentProps } from 'react-router-dom'
// import { ProtoMap } from 'babbage-protomap'
// import { Img } from 'uhrp-react'
import makeStyles from '@mui/styles/makeStyles'
import { useTheme } from '@mui/styles'
import style from './style'
import { DEFAULT_APP_ICON } from '../../constants/popularApps'
// import confederacyHost from '../../utils/confederacyHost'
import CounterpartyChip from '../CounterpartyChip/index'
import DataObject from '@mui/icons-material/DataObject'
import { toast } from 'react-toastify'
import PlaceholderAvatar from '../PlaceholderAvatar'
// import { SettingsContext } from '../../context/SettingsContext'

const useStyles = makeStyles(style as any, {
  name: 'ProtoChip'
})

interface ProtoChipProps extends RouteComponentProps {
  securityLevel: string
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
  onCloseClick = () => { },
  canRevoke = true,
  description,
  iconURL,
  backgroundColor = 'transparent'
}) => {
  const classes = useStyles()
  const theme: any = useTheme()
  // const { settings } = useContext(SettingsContext)

  // Initialize ProtoMap
  // const protomap = new ProtoMap()
  // protomap.config.confederacyHost = confederacyHost()

  const [protocolName,
    // setProtocolName
  ] = useState(protocolID)
  const [iconURLState,
    // setIconURL
  ] = useState(
    iconURL || DEFAULT_APP_ICON
  )
  const [imageError, setImageError] = useState(false)
  const [descriptionState,
    // setDescription
  ] = useState(
    description || 'Protocol description not found.'
  )
  const [documentationURL,
    // setDocumentationURL
  ] = useState('https://projectbabbage.com')

  // Handle image loading errors
  const handleImageError = () => {
    setImageError(true);
  }

  const chipStyle = theme.templates.chip({ size, backgroundColor })

  if (typeof protocolID !== 'string') {
    console.log('ProtoChip: protocolID must be a string. Received:', protocolID)
    return null
  }

  return (
    <div className={classes.chipContainer}>
      <Chip
        style={chipStyle}
        avatar={
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
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
            }
          >
            {!imageError ? (
              <Avatar
                src={iconURLState}
                alt={protocolName}
                sx={{ width: size * 32, height: size * 32 }}
                onError={handleImageError}
              />
            ) : (
              <PlaceholderAvatar
                name={protocolName}
                size={size * 32}
              />
            )}
          </Badge>
        }
        label={
          <Grid container spacing={1} alignItems="center">
            <Grid item xs>
              <div className={classes.chipLabel}>
                {protocolName}
                {counterparty && (
                  <CounterpartyChip
                    size={size * 0.8}
                    counterparty={counterparty}
                  />
                )}
              </div>
            </Grid>
          </Grid>
        }
        onClick={clickable ? onClick : undefined}
        onDelete={canRevoke ? onCloseClick : undefined}
        deleteIcon={canRevoke ? <CloseIcon /> : undefined}
      />
      {expires && (
        <div className={classes.expires}>
          Expires {expires}
        </div>
      )}
    </div>
  )
}

export default withRouter(ProtoChip)
