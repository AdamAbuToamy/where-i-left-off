// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { computeAccessibleName } from 'dom-accessibility-api'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import WelcomeTour from '../src/components/WelcomeTour'
import { tourText } from '../src/tourText'
let root:Root, container:HTMLDivElement
beforeEach(() => {
 localStorage.clear();location.hash='#/personal'
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(() => { act(() => root.unmount());container.remove();vi.unstubAllGlobals() })
it.each(['ar','en','he'] as const)('tour close button has the exact translated name and dismisses in %s', language => {
 const user={uid:'new-user',metadata:{creationTime:new Date().toUTCString()}} as User
 act(() => root.render(<WelcomeTour user={user} language={language} />))
 const button=container.querySelector<HTMLButtonElement>('.guide-skip')!
 expect(button).not.toBeNull()
 expect(computeAccessibleName(button)).toBe(tourText[language].skip)
 act(() => button.click())
 expect(container.querySelector('.welcome-guide')).toBeNull()
 expect(localStorage.getItem('welcome-tour:v2:new-user')).toBe('done')
 act(() => window.dispatchEvent(new Event('replay-welcome-tour')))
 expect(container.querySelector('.welcome-guide')).not.toBeNull()
})
