import { Dispatch, SetStateAction, useState, useEffect, useContext } from 'react'
import { DialogContent, DialogContentText, DialogActions, Button, Paper, Typography, Divider } from '@mui/material'
import CustomDialog from '../CustomDialog/index'
import { WalletContext } from '../../UserInterface'
import AppChip from '../AppChip/index'
import ProtoChip from '../ProtoChip/index.tsx'
import { PermissionEventHandler, PermissionRequest } from '@bsv/wallet-toolbox-client'
import { useTheme } from '@mui/material/styles'
import Avatar from '@mui/material/Avatar'
// Import custom icons for each permission type
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import CodeIcon from '@mui/icons-material/Code'
import CachedIcon from '@mui/icons-material/Cached'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'

// Permission request types
type PermissionType = 'identity' | 'protocol' | 'renewal' | 'basket';

interface PermissionItem {
  requestID: string;
  protocolSecurityLevel: number;
  protocolID: string;
  counterparty?: string;
  originator?: string;
  description?: string;
  renewal?: boolean;
  type?: PermissionType;
}

const ProtocolPermissionHandler: React.FC<{
  setProtocolPermissionCallback: Dispatch<SetStateAction<PermissionEventHandler>>
}> = ({ setProtocolPermissionCallback }) => {
  const {
    onFocusRequested,
    onFocusRelinquished,
    isFocused,
    managers
  } = useContext(WalletContext)
  const [wasOriginallyFocused, setWasOriginallyFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState<Array<PermissionItem>>([])

  const theme = useTheme()

  const handleCancel = () => {
    managers.permissionsManager.denyPermission(perms[0].requestID)
    setPerms(prev => {
      const newPerms = prev.slice(1)
      if (newPerms.length === 0) {
        setOpen(false)
        if (!wasOriginallyFocused) {
          onFocusRelinquished()
        }
      }
      return newPerms
    })
  }

  const handleGrant = () => {
    managers.permissionsManager.grantPermission({ requestID: perms[0].requestID })
    setPerms(prev => {
      const newPerms = prev.slice(1)
      if (newPerms.length === 0) {
        setOpen(false)
        if (!wasOriginallyFocused) {
          onFocusRelinquished()
        }
      }
      return newPerms
    })
  }

  useEffect(() => {
    setProtocolPermissionCallback(() => {
      return async (args: PermissionRequest & { requestID: string }): Promise<void> => {
        const {
          requestID,
          counterparty,
          originator,
          reason,
          renewal,
          protocolID
        } = args
        const [protocolSecurityLevel, protocolNameString] = protocolID!
        
        // First check if we're already focused
        const wasOriginallyFocused = await isFocused()
        
        // Determine type of permission
        let permissionType: PermissionType = 'protocol';
        if (protocolNameString === 'identity resolution') {
          permissionType = 'identity';
        } else if (renewal) {
          permissionType = 'renewal';
        } else if (protocolNameString.includes('basket')) {
          permissionType = 'basket';
        }
        
        // Create the new permission request
        const newItem: PermissionItem = {
          requestID,
          protocolSecurityLevel,
          protocolID: protocolNameString,
          counterparty,
          originator,
          description: reason,
          renewal,
          type: permissionType
        }
        
        // Update state in a single batch
        await Promise.all([
          // Request focus if needed
          !wasOriginallyFocused ? onFocusRequested() : Promise.resolve(),
          // Set the original focus state
          new Promise<void>(resolve => {
            setWasOriginallyFocused(wasOriginallyFocused)
            resolve()
          }),
          // Add the new permission request
          new Promise<void>(resolve => {
            setPerms(p => [...p, newItem])
            resolve()
          })
        ])
        
        // Finally, open the dialog
        setOpen(true)
      }
    })
  }, [])

  // Only render if we have both dialog open and permissions to show
  if (!open || perms.length === 0) {
    return null
  }

  // Get the current permission request
  const currentPerm = perms[0]
  if (!currentPerm) {
    return null
  }

  // Permission type documents
  const permissionTypeDocs = {
    identity: {
      title: 'Trusted Entities Access Request',
      description: 'An app is requesting access to lookup identity information using the entities you trust.',
      color: theme.palette.info.main,
      icon: <VerifiedUserIcon fontSize="medium" />
    },
    renewal: {
      title: 'Protocol Access Renewal',
      description: 'An app is requesting to renew its previous access to a protocol using your information.',
      color: theme.palette.success.main,
      icon: <CachedIcon fontSize="medium" />
    },
    basket: {
      title: 'Basket Access Request',
      description: 'An app is requesting access to a basket of your data to perform a specific task.',
      color: theme.palette.warning.main,
      icon: <ShoppingBasketIcon fontSize="medium" />
    },
    protocol: {
      title: 'Protocol Access Request',
      description: 'An app is requesting to talk in a specific language (protocol) using your information.',
      color: theme.palette.primary.main,
      icon: <CodeIcon fontSize="medium" />
    }
  };

  // Get permission type document
  const getPermissionTypeDoc = () => {
    // Default to protocol if type is undefined
    const type = currentPerm.type || 'protocol';
    return permissionTypeDocs[type];
  };

  const getIconAvatar = () => (
    <Avatar 
      sx={{ 
        bgcolor: deterministicColor(currentPerm.protocolID),
        width: 40,
        height: 40,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {getPermissionTypeDoc().icon}
    </Avatar>
  );

  return (
    <CustomDialog
      open={open}
      title={getPermissionTypeDoc().title}
    >
      <Paper 
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          mb: 2,
          borderLeft: `6px solid ${getPermissionTypeDoc().color}`,
          bgcolor: 'rgba(0, 0, 0, 0.02)'
        }}
      >
        {getIconAvatar()}
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color={getPermissionTypeDoc().color}>
            {currentPerm.type?.toUpperCase() || 'PROTOCOL'} ACCESS
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {getPermissionTypeDoc().description}
          </Typography>
        </div>
      </Paper>

      <DialogContent>
        <div style={{ 
          display: 'grid', 
          gap: theme.spacing(3),
          maxWidth: '100%'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'auto 1fr', 
            alignItems: 'center', 
            gap: theme.spacing(2) 
          }}>
            <Typography variant="body1" fontWeight="bold">App:</Typography>
            {currentPerm.originator && 
              <AppChip
                size={2.5}
                showDomain
                label={currentPerm.originator}
                clickable={false}
              />
            }
          </div>

          <Divider />

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'auto 1fr', 
            alignItems: 'center', 
            gap: theme.spacing(2)
          }}>
            <Typography variant="body1" fontWeight="bold">Protocol:</Typography>
            <ProtoChip
              securityLevel={currentPerm.protocolSecurityLevel.toString()}
              protocolID={currentPerm.protocolID}
              counterparty={currentPerm.counterparty}
            />
          </div>

          {currentPerm.description && (
            <>
              <Divider />
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'auto 1fr', 
                alignItems: 'start', 
                gap: theme.spacing(2)
              }}>
                <Typography variant="body1" fontWeight="bold">Reason:</Typography>
                <DialogContentText style={{ margin: 0 }}>
                  {currentPerm.description}
                </DialogContentText>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleCancel}
          variant="outlined"
          color="inherit"
        >
          Deny
        </Button>
        <Button 
          onClick={handleGrant}
          variant="contained"
          color={currentPerm.type === 'identity' ? 'info' : 'primary'}
        >
          Grant Access
        </Button>
      </DialogActions>
    </CustomDialog>
  )
}

export default ProtocolPermissionHandler
