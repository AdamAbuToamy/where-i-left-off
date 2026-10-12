export type Project = {
  id: string
  name: string
  nextStep: string
  status: 'later' | 'active'
  rank: number
  revision: number
}