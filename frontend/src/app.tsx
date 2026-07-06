import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/nprogress/styles.layer.css'
import '@gfazioli/mantine-spinner/styles.css'

import './global.css'

import { DirectionProvider, MantineProvider, v8CssVariablesResolver } from '@mantine/core'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import { enableMainThreadBlocking } from 'ios-vibrator-pro-max'
import { NavigationProgress } from '@mantine/nprogress'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useMemo } from 'react'

import {
    applyRezeisCssVars,
    resolvePrimaryColor,
    type RezeisTheme
} from '@shared/constants/theme/rezeis-theme'
import { useAppConfigNullable } from '@entities/app-config-store'
import { initDayjs } from '@shared/utils/time-utils'
import { theme } from '@shared/constants'

import { Router } from './app/router/router'

polyfillCountryFlagEmojis()

enableMainThreadBlocking(false)

initDayjs()

export function App() {
    const mq = useMediaQuery('(min-width: 40em)')

    const rezeisTheme = (useAppConfigNullable() as null | { rezeisTheme?: RezeisTheme })
        ?.rezeisTheme

    useEffect(() => {
        applyRezeisCssVars(rezeisTheme)
    }, [rezeisTheme])

    const activeTheme = useMemo(() => {
        const primaryColor = resolvePrimaryColor(rezeisTheme)
        return primaryColor ? { ...theme, primaryColor } : theme
    }, [rezeisTheme])

    return (
        <DirectionProvider>
            <MantineProvider
                cssVariablesResolver={v8CssVariablesResolver}
                defaultColorScheme="dark"
                theme={activeTheme}
            >
                <ModalsProvider>
                    <Notifications position={mq ? 'top-right' : 'bottom-right'} />
                    <NavigationProgress />

                    <Router />
                </ModalsProvider>
            </MantineProvider>
        </DirectionProvider>
    )
}
