/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import cli from 'cli-ux'
import chalk from 'chalk'
import { Version2Client } from 'jira.js'
import { IssueBean, IssuePickerSuggestions, Project, SuggestedIssue } from 'jira.js/out/version2/models'
import { moveIssueToStatus } from '../flows/commit-flow'
import { AuthConfigType } from '../types/types'
import core from './core'

function uniq(a: string[]): string[] {
  return [...new Set(a)]
}

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
          resolve()
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getIssueBasedOnIdOrKey = (idOrKey: string): Promise<IssueBean> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const currentIssue = await this.client.issues.getIssue({ issueIdOrKey: idOrKey })
          resolve(currentIssue)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAllStatusesForProject = (projectId: string): Promise<string[]> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        const issueTypes = await this.client.projects.getAllStatuses({ projectIdOrKey: projectId })
        const statuses = issueTypes.map(issueType => issueType.statuses.map(status => status.name!)).flat()
        resolve(uniq(statuses))
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  moveIssueToNewStatus = (id: string, projectID: string): Promise<void> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          console.log('\n')
          cli.action.start('Fetching info about current status')
          const issueTypes = await this.client.projects.getAllStatuses({ projectIdOrKey: projectID })

          const currentIssue = await this.client.issues.getIssue({ issueIdOrKey: id.toString() })
          const currentIssueStatusName = currentIssue.fields.status.name

          const currentIssueType = { name: currentIssue.fields.issuetype?.name, id: currentIssue.fields.issuetype?.id }
          let statuses: {
            name?: string
            category?: string
            id?: string
            categoryId?: number
          }[] = []

          console.log(`Current issue status is: ${chalk.green.bold(currentIssueStatusName)}`)
          console.log('\n')

          issueTypes.forEach(issueType => {
            if (issueType.id.toString() === currentIssueType.id?.toString()) {
              statuses = issueType.statuses
            }
          })

          const availableNewStatuses = statuses
            .map(status => status.name!)
            .filter(status => status !== currentIssueStatusName)

          cli.action.stop()
          console.log('\n')

          const newStatus = await moveIssueToStatus(availableNewStatuses)

          console.log('\n')
          cli.action.start('Moving ticket')
          const transition = await this.client.issues.getTransitions({ issueIdOrKey: currentIssue.key! })
          await this.client.issues.doTransition({
            issueIdOrKey: currentIssue.key!,
            transition: transition.transitions?.filter(trans => trans.name === newStatus.newStatus)[0],
          })
          cli.action.stop()
          console.log('\n')

          resolve()
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getIssuesBasedOnName = (tickets: IssuePickerSuggestions, selectedTicket: { ticket: string }): SuggestedIssue => {
    if (!tickets || !tickets.sections) {
      return {}
    }

    const currTicket = tickets.sections[0].issues?.filter(issue => {
      if (issue.key === selectedTicket.ticket.split(` -`)[0]) {
        return true
      }

      return false
    })[0]

    if (currTicket) {
      return currTicket
    }

    return {}
  }
}

export default new Jira()
