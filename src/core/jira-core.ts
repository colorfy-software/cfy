/* eslint-disable @typescript-eslint/no-non-null-assertion */
import cli from 'cli-ux'
import chalk from 'chalk'
import { Version2Client } from 'jira.js'
import { Component, CreatedIssue, IssueBean, Project, SearchResults, User } from 'jira.js/out/version2/models'

import core from './core'
import { amountOfTimeEstimated, amountOfTimeSpent, assignIssueTo, moveIssueToStatus } from '../flows/commit-flow'

import { AuthConfigType } from '../types/types'
import {
  chooseComponentForIssue,
  chooseLabelForIssue,
  chooseTypeForIssue,
  getStatusesForProject,
  issueDescription,
  issueTitle,
  projectSelectionQuestion,
} from '../flows/init-setup-flow'
import sleep from '../utils/sleep'

function uniq(a: string[]): string[] {
  return [...new Set(a)]
}

class Jira {
  client: null | Version2Client = null
  accountId: undefined | string = undefined

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

  getJQLTicketsForCurrentProject = async (projectId: string, JQL: string): Promise<SearchResults> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const accountId = await this.getAccountID()

          const jql = await this.client.issueSearch.searchForIssuesUsingJql({
            jql: `project = ${projectId} AND assignee in (${accountId}) AND ${JQL} order by created DESC `,
          })

          resolve(jql)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAllTicketsAssignedToUserForCurrentProject = async (projectId: string): Promise<SearchResults> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const accountId = await this.getAccountID()

          const jql = await this.client.issueSearch.searchForIssuesUsingJql({
            jql: `project = ${projectId} AND assignee in (${accountId}) order by created DESC`,
          })

          resolve(jql)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAllTicketsForCurrentProject = async (projectId: string): Promise<SearchResults> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const jql = await this.client.issueSearch.searchForIssuesUsingJql({
            jql: `project = ${projectId} order by created DESC`,
          })

          resolve(jql)
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
        const statuses = issueTypes.flatMap(issueType => issueType.statuses.map(status => status.name!))
        resolve(uniq(statuses))
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAllIssueTypesForProject = (projectId: string): Promise<string[]> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        const issueTypes = (await this.client.projects.getProject({ projectIdOrKey: projectId })).issueTypes!
        resolve(
          issueTypes
            .map(issueType => `${issueType.name!} - ${issueType.description}`)
            .filter(issueType => !issueType.startsWith('Subtask')),
        )
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  getAllUsers = (projectId: string): Promise<User[]> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const users = await this.client.userSearch.findAssignableUsers({ project: projectId })
          resolve(users)
        } catch (error) {
          console.log(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  assignTicketToANewUser = (issueIdOrKey: string, accountId: string): Promise<void> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          await this.client.issues.assignIssue({ issueIdOrKey, accountId })
          resolve()
        } catch (error) {
          console.log(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  updateTimeSpent = (issueIdOrKey: string, time: string): Promise<void> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          await this.client.issueWorklogs.addWorklog({ issueIdOrKey, timeSpent: time })
          resolve()
        } catch (error) {
          console.log(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  updateTimeAndEstimate = (issueIdOrKey: string, time: string, estimate: string): Promise<void> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        const body: {
          timeSpent?: string
          newEstimate?: string
        } = {}

        if (time !== '') {
          body.timeSpent = time
        }

        if (estimate !== '') {
          body.newEstimate = estimate
        }

        if (Object.keys(body).length > 0) {
          try {
            await this.client.issueWorklogs.addWorklog({ issueIdOrKey, ...body })
            resolve()
          } catch (error) {
            console.log(error)
          }
        } else {
          resolve()
        }
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

          for (const issueType of issueTypes) {
            if (issueType.id.toString() === currentIssueType.id?.toString()) {
              statuses = issueType.statuses
            }
          }

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
            transition: transition.transitions?.filter(
              trans => (trans.to?.name || trans.name) === newStatus.newStatus,
            )[0],
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

  getIssuesBasedOnName = (
    tickets: SearchResults,
    selectedTicket: { ticket: string },
  ): IssueBean | Record<string, unknown> => {
    if (!tickets || !tickets.issues) {
      return {}
    }

    const currTicket = tickets.issues?.filter(issue => {
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

  connectCfyToProject = (authConfig: AuthConfigType): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        this.configureClientFromConfigFile(authConfig)
        console.log('\n')
        cli.action.start('Fetching Jira projects')
        const jiraProjects = await this.getProjectsForAccount()
        cli.action.stop()
        console.log('\n')

        const projectSettings = await projectSelectionQuestion(jiraProjects)

        console.log(chalk.yellow('\nNow we need to filter out correct tickets from all of the statuses\n'))

        const projectNameToUse = projectSettings.projectName
        const jiraProject = jiraProjects.find(project => `${project.key} - ${project.name}` === projectNameToUse)
        const availableStatuses = await this.getAllStatusesForProject(jiraProject!.id!)
        const selectedStatuses = await getStatusesForProject(availableStatuses)

        // eslint-disable-next-line unicorn/no-array-reduce
        const JQLString = selectedStatuses.statusSelections.reduce((accumulator, currentValue, index, array) => {
          accumulator += currentValue.split(' ').length > 1 ? `"${currentValue}"` : `${currentValue}`

          accumulator += array.length - 1 === index ? ')' : `, `

          return accumulator
        }, 'status in (')

        core.fs.createAndStoreConfigFile({
          projectId: jiraProject!.id!,
          projectKey: jiraProject!.key!,
          JQL: JQLString,
        })

        await sleep(500)

        console.log(chalk.green.bold("\nYou're all setup to use cfy now :)\n"))
        console.log(`Commit message config is available at ${chalk.blue.bold(core.fs.getProjectConfigFilePath())}\n`)

        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  getComponentsForProject = (projectId: string): Promise<Component[]> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      if (this.client) {
        try {
          const components = await this.client.projectComponents.getProjectComponents({ projectIdOrKey: projectId })
          resolve(components)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('No client provided'))
      }
    })
  }

  createIssue = (projectId: string): Promise<CreatedIssue> => {
    if (!this.client) {
      this.configureClientFromConfigFile()
    }

    return new Promise(async (resolve, reject) => {
      try {
        const components = await this.getComponentsForProject(projectId)

        console.log('\n')
        console.log('Creating a issue..')
        console.log('\n')
        const title = (await issueTitle()).title
        const description = (await issueDescription()).description

        // get all possible issue types for the project
        const issueTypes = await this.getAllIssueTypesForProject(projectId)
        const selectedIssueType = (await chooseTypeForIssue(issueTypes)).typeSelections.split(' ')[0]

        const labels = await this.client?.labels.getAllLabels()

        let selectedLabels: string[] = []

        if (labels?.values?.length) {
          selectedLabels = [(await chooseLabelForIssue(labels!.values!)).labelSelections]
          selectedLabels = selectedLabels[0] === 'Skipping label for issue' ? [] : selectedLabels
        }

        let selectedComponent = ''

        if (components.length > 0) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          selectedComponent = (await chooseComponentForIssue(components.map(c => c.name))).componentSelections.split(
            ' ',
          )[0]
          selectedComponent = selectedComponent === 'Skipping component for issue' ? '' : selectedComponent
        }

        const issue = await this.client?.issues.createIssue({
          fields: {
            project: {
              id: projectId,
            },
            labels: selectedLabels as unknown as string[],
            summary: title,
            description,
            components: selectedComponent
              ? [{ id: components.find(component => component.name === selectedComponent)?.id }]
              : [],
            issuetype: {
              name: selectedIssueType,
            },
          },
        })

        const estimate = (await amountOfTimeEstimated()).time
        const time = (await amountOfTimeSpent()).time

        await this.updateTimeAndEstimate(issue!.id!, time, estimate)

        if (time !== '' && estimate !== '') {
          console.log(`Added ${estimate} estimate and ${time} to time spent`)
          console.log('\n')
        } else if (time !== '') {
          console.log(`Added ${time} to time spent`)
          console.log('\n')
        } else if (estimate !== '') {
          console.log(`Added ${estimate} to estimate`)
          console.log('\n')
        }

        const users = await this.getAllUsers(projectId)
        const userToAssignTo = (await assignIssueTo(users)).user
        const userIdToAssignTo = users.find(u => u.displayName === userToAssignTo)?.accountId
        await this.assignTicketToANewUser(issue!.id!, userIdToAssignTo!)
        await this.moveIssueToNewStatus(issue!.id!, projectId)

        resolve(issue!)
      } catch (error) {
        console.log(error)
        reject(error)
      }
    })
  }
}

export default new Jira()
