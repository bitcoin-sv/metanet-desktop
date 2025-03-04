import React, { useContext } from 'react'
import { Typography, Divider } from '@mui/material'
import { makeStyles } from '@mui/styles'
import style from './style'
import { WalletContext } from '../../../../UserInterface'

const useStyles = makeStyles(style, {
  name: 'About'
})

const About = () => {
  const classes = useStyles()
  const { appName, appVersion } = useContext(WalletContext)

  return (
    <div className={classes.content_wrap}>
      <Typography variant='h2' paragraph color='textPrimary'>
        Software Versions
      </Typography>
      <Typography paragraph>
        {appName} Version: {appVersion}
      </Typography>
      <br />
      <Divider />
      <br />
      <Typography variant='h2' paragraph color='textPrimary'>
        Legal
      </Typography>
      <Typography paragraph variant='body' color='textSecondary'>
        After SOW E and SOW F are executed this will be licensed under the Open BSV License from BSV Association. Until then the wallet and all of its code is owned and solely proprietary within P2PPSR.
      </Typography>
      <br />
    </div>
  )
}

export default About
