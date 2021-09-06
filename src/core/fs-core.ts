import os from 'os'
import findGitRoot from 'find-git-root'
import { existsSync, readFileSync, writeFile } from 'fs'

import { AuthConfigType, ProjectConfigType } from '../types/types'

class Fs {
  authConfig: null | AuthConfigType = null
  projectConfig: null | ProjectConfigType = null

  getAuthConfigPath = (): string => {
    switch (os.platform()) {
      case 'win32':
        return `${os.homedir()}/.cfy`
      case 'darwin':
        return `${os.homedir()}/.cfy`
      default:
        return `${os.homedir()}/.config/.cfy`
    }
  }

  getProjectConfigFilePath = (): string => {
    const root = findGitRoot(process.cwd())
    const configFile = `${root.split('.git')[0]}cfy-config.json`

    return configFile
  }

  getProjectConfig = (): null | ProjectConfigType => {
    const configFilePath = this.getProjectConfigFilePath()

    if (existsSync(configFilePath)) {
      const configFileRaw = readFileSync(configFilePath, {
        encoding: 'utf8',
      })
      const config = JSON.parse(configFileRaw)

      this.authConfig = config
      return config
    }

    return null
  }

  hasAuthenticated = (): boolean => {
    const authFilePath = this.getAuthConfigPath()

    if (existsSync(authFilePath)) {
      const authFileRaw = readFileSync(authFilePath)
      console.log(authFileRaw)

      return true
    }

    return false
  }

  getAuthConfig = (): AuthConfigType | null => {
    const authFilePath = this.getAuthConfigPath()

    if (existsSync(authFilePath)) {
      const authFileRaw = readFileSync(authFilePath, {
        encoding: 'utf8',
      })

      return JSON.parse(authFileRaw)
    }

    return null
  }

  createAndStoreAuthFile = ({ domain, email, token }: { domain: string; email: string; token: string }): void => {
    const authFilePath = this.getAuthConfigPath()

    this.authConfig = {
      domain,
      email,
      api_token: token,
    }

    writeFile(
      authFilePath,
      JSON.stringify({
        domain,
        email,
        api_token: token,
      }),
      error => {
        error && console.log(error)
      },
    )
  }

  createAndStoreConfigFile = ({
    projectId,
    projectKey,
    JQL,
  }: {
    projectId: string
    projectKey: string
    JQL: string
  }): void => {
    const configFilePath = this.getProjectConfigFilePath()

    this.projectConfig = {
      project_id: projectId,
      project_key: projectKey,
      JQL,
    }

    writeFile(
      configFilePath,
      JSON.stringify({
        project_id: projectId,
        project_key: projectKey,
        JQL,
      }),
      error => {
        error && console.log(error)
      },
    )
  }
}

export default new Fs()
