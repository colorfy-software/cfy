import { Version2Client } from 'jira.js'
import { IssuePickerSuggestions, Project } from 'jira.js/out/version2/models'
import { AuthConfigType } from '../types/types'
import core from './core'

class Jira {
  private client: null | Version2Client = null
  private accountId: undefined | string = undefined

  configureClientFromConfigFile = (config?: AuthConfigType) => {
    const jiraConfig = config || core.fs.getAuthConfig()

    this.client = new Version2Client({
      host: `https://${jiraConfig?.domain}.atlassian.net`,
      authentication: {
        basic: {
          email: jiraConfig?.email || '',
          apiToken: jiraConfig?.api_token || '',
        },
      },
    })

    return this.client
  }

  configureJiraClient = ({
    domain,
    email,
    token,
  }: {
    domain: string
    email: string
    token: string
  }): Version2Client => {
    this.client = new Version2Client({
      host: `https://${domain}.atlassian.net`,
      authentication: {
        basic: {
          email,
          apiToken: token,
        },
      },
    })

    return this.client
  }

  getProjectsForAccount = async (): Promise<Project[]> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const projects = await this.client.projects.getAllProjects()

          resolve(projects)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getTicketsForCurrentProject = async (projectId: string, JQL: string): Promise<IssuePickerSuggestions> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const accountId = await this.getAccountID()

          const issuesForProject = await this.client.issueSearch.getIssuePickerResource({
            currentProjectId: projectId,
            currentJQL: `assignee in (${accountId}) AND ${JQL}`,
          })

          resolve(issuesForProject)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAccountID = (): Promise<string | null | undefined> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.accountId) {
        resolve(this.accountId)
      }

      if (this.client) {
        try {
          const currentUser = await this.client.myself.getCurrentUser()
          this.accountId = currentUser.accountId
          resolve(currentUser.accountId)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  addCommentToIssue = (id: string, comment: string): Promise<void> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          await this.client.issueComments.addComment({ issueIdOrKey: id, body: comment })
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }
}

export default new Jira()
