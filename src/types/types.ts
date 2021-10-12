/* eslint-disable camelcase */
export interface AuthConfigType {
  domain: string
  email: string
  api_token: string
}

export interface ProjectConfigType {
  project_id: string
  project_key: string
  JQL: string
  template?: string | undefined
  wip_flag_template?: string | undefined
  commit_type_case?: 'uppercase' | 'lowercase' | undefined
}
