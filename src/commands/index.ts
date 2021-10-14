/* eslint-disable max-params */
/* eslint-disable camelcase */
/* eslint-disable complexity */
/* eslint-disable no-implicit-coercion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-negated-condition */
import cli from 'cli-ux'
import chalk from 'chalk'
import { prompt } from 'inquirer'
import inquirer = require('inquirer')
import { Command, flags } from '@oclif/command'
import { IssueBean } from 'jira.js/out/version2/models'
import { SuggestedIssue } from 'jira.js/out/version2/models/suggestedIssue'

import core from '../core/core'
import sleep from '../utils/sleep'
import { runCommand } from '../helpers/commands'
import { addCommentToIssueInput, amountOfTimeSpent, assignIssueTo, commitTypeQuestion } from '../flows/commit-flow'
import {
  initAuthSetupQuestion,
  ticketSelectionQuestion,
  initProjectSetupQuestion,
  jiraAuthenticationQuestions,
  initContinueToCommitting,
} from '../flows/init-setup-flow'

import { AuthConfigType, ProjectConfigType } from '../types/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
inquirer.registerPrompt('search-list', require('inquirer-search-list'))

const constructCommitMessage = (
  ticketNumber: string,
  commitType: string,
  wip: boolean,
  message: string,
  config: ProjectConfigType,
) => {
  const { template, wip_flag_template, commit_type_case } = config

  let type
  if (template) {
    switch (commit_type_case) {
      case 'lowercase':
        type = commitType.toLowerCase()
        break
      case 'uppercase':
        type = commitType.toUpperCase()
        break
      default:
        type = commitType.toLowerCase()
    }

    const wipTemplateString = wip ? wip_flag_template || ' | WIP' : ''
    return template
      .replace('%JIRA_TICKET_KEY%', ticketNumber)
      .replace('%WIP_FLAG%', wipTemplateString)
      .replace('%COMMIT_TYPE%', type)
      .replace('%COMMIT_MESSAGE%', message)
  }

  const prefix = `[${ticketNumber}${wip ? ' | WIP' : ''}]`
  type = `- ${commitType.toUpperCase()}`

  const commitMessage = message.length > 0 ? `- ${message}` : ''

  return `${prefix} ${type} ${commitMessage}`
}

export default class Create extends Command {
  static description = 'Create a new commit'
  static flags = {
    // can pass either --force or -f
    ticket: flags.boolean({ char: 't' }),
    auth: flags.boolean({ char: 'a' }),
    config: flags.boolean({ char: 'c' }),
  }

  hasDoneAuthConfig = false

  async setupProjectWithCfy(authConfig: AuthConfigType): Promise<void> {
    try {
      await core.jira.connectCfyToProject(authConfig)
      const shouldContinue = await initContinueToCommitting()

      if (shouldContinue.value) {
        this.run()
      }
    } catch (error) {
      this.log(`${chalk.red(error)}`)
    }
  }

  async handleTicketAfterCommit(issue: SuggestedIssue | IssueBean, projectID: string): Promise<void> {
    const currentIssue = await core.jira.getIssueBasedOnIdOrKey(issue.key!)

    const data = [
      {
        label: 'Add comment to the ticket',
        value: 1,
      },
      {
        label: 'Move ticket to another status',
        value: 2,
      },
      {
        label: 'Update time spent on the ticket',
        value: 3,
      },
      {
        label: 'Reassign ticket to another person',
        value: 4,
      },
      {
        label: 'Exit',
        value: 5,
      },
    ]

    cli.table(data, {
      commands: {
        get: row => row.value,
      },
      action: {
        get: row => row.label,
      },
    })

    this.log('\n')

    const output = await prompt([
      {
        type: 'input',
        name: 'next',
        message: 'Enter the command you wish to proceed with',
        validate(value) {
          if (value.length === 0) {
            return 'Sorry, you need to enter something here'
          }

          return true
        },
      },
    ])

    if (parseInt(output.next, 10) === 1) {
      const ticketKey = currentIssue.key!
      const comment = (await addCommentToIssueInput()).comment
      this.log('\n')
      cli.action.start('Adding comment to the ticket')
      await core.jira.addCommentToIssue(ticketKey, comment)
      cli.action.stop()
      this.log('\n')

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 2) {
      // Move ticket to new column
      await core.jira.moveIssueToNewStatus(currentIssue.id!, projectID)

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 3) {
      const time = (await amountOfTimeSpent()).time
      this.log('\n')
      cli.action.start('Updating time spent')
      await core.jira.updateTimeSpent(currentIssue.id!, time)
      cli.action.stop(`Added ${time} to time spent`)
      this.log('\n')

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 4) {
      this.log('\n')
      cli.action.start('Getting user list')
      const users = await core.jira.getAllUsers(projectID)
      cli.action.stop()
      this.log('\n')

      const userToAssignTo = (await assignIssueTo(users)).user
      const userIdToAssignTo = users.filter(u => u.displayName === userToAssignTo)[0].accountId

      this.log('\n')
      cli.action.start('Assigning ticket')
      await core.jira.assignTicketToANewUser(currentIssue.id!, userIdToAssignTo!)
      cli.action.stop(`Ticket has been assigned to ${userToAssignTo}`)
      this.log('\n')

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 5) {
      this.log(chalk.green('\nAll done :)\n'))
    }
  }

  async handleTicket(issue: SuggestedIssue | IssueBean, projectID: string): Promise<void> {
    const currentIssue = await core.jira.getIssueBasedOnIdOrKey(issue.key!)

    this.log('\n')

    const data = [
      {
        label: 'Add comment to the ticket',
        value: 1,
      },
      {
        label: 'Move ticket to another status',
        value: 2,
      },
      {
        label: 'Update time spent on the ticket',
        value: 3,
      },
      {
        label: 'Reassign ticket to another person',
        value: 4,
      },
      {
        label: 'Select another ticket',
        value: 5,
      },
      {
        label: 'Exit',
        value: 6,
      },
    ]

    cli.table(data, {
      commands: {
        get: row => row.value,
      },
      action: {
        get: row => row.label,
      },
    })

    this.log('\n')

    const output = await prompt([
      {
        type: 'input',
        name: 'next',
        message: 'Enter the command you wish to proceed with',
        validate(value) {
          if (value.length === 0) {
            return 'Sorry, you need to enter something here'
          }

          return true
        },
      },
    ])

    if (parseInt(output.next, 10) === 1) {
      const ticketKey = currentIssue.key!
      const comment = (await addCommentToIssueInput()).comment
      this.log('\n')
      cli.action.start('Adding comment to the ticket')
      await core.jira.addCommentToIssue(ticketKey, comment)
      cli.action.stop()
      this.log('\n')

      sleep(50)
      this.handleTicket(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 2) {
      // Move ticket to new column
      await core.jira.moveIssueToNewStatus(currentIssue.id!, projectID)

      sleep(50)
      this.handleTicket(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 3) {
      const time = (await amountOfTimeSpent()).time
      this.log('\n')
      cli.action.start('Updating time spent')
      await core.jira.updateTimeSpent(currentIssue.id!, time)
      cli.action.stop(`Added ${time} to time spent`)
      this.log('\n')

      sleep(50)
      this.handleTicket(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 4) {
      this.log('\n')
      cli.action.start('Getting user list')
      const users = await core.jira.getAllUsers(projectID)
      cli.action.stop()
      this.log('\n')

      const userToAssignTo = (await assignIssueTo(users)).user
      const userIdToAssignTo = users.filter(u => u.displayName === userToAssignTo)[0].accountId

      this.log('\n')
      cli.action.start('Assigning ticket')
      await core.jira.assignTicketToANewUser(currentIssue.id!, userIdToAssignTo!)
      cli.action.stop(`Ticket has been assigned to ${userToAssignTo}`)
      this.log('\n')

      sleep(50)
      this.handleTicket(currentIssue, projectID)
    }

    if (parseInt(output.next, 10) === 5) {
      this.run()
    }

    if (parseInt(output.next, 10) === 6) {
      this.log(chalk.green('\nAll done :)\n'))
    }
  }

  async run(): Promise<void> {
    const { flags: properties } = this.parse(Create)
    const authConfig = core.fs.getAuthConfig()
    const projectConfig = core.fs.getProjectConfig()

    // take actions on a ticket (using -t)
    if (properties.ticket && authConfig && projectConfig) {
      core.jira.configureClientFromConfigFile(authConfig)

      this.log('\n')

      const data = [
        {
          label: 'Show tickets from config statuses',
          value: 1,
        },
        {
          label: 'Show all tickets assigned to you',
          value: 2,
        },
        {
          label: 'Show all tickets in the project',
          value: 3,
        },
        {
          label: 'Create a ticket',
          value: 4,
        },
        {
          label: 'Exit',
          value: 5,
        },
      ]

      cli.table(data, {
        commands: {
          get: row => row.value,
        },
        action: {
          get: row => row.label,
        },
      })

      this.log('\n')

      const output = await prompt([
        {
          type: 'input',
          name: 'actionValue',
          message: 'Enter the command you wish to proceed with',
          default: 1,
          validate(value) {
            if (value.length === 0) {
              return 'Sorry, you need to enter something here'
            }

            return true
          },
        },
      ])

      if (parseInt(output.actionValue, 10) === 1) {
        core.jira.configureClientFromConfigFile(authConfig)
        this.log('\n')
        cli.action.start('Fetching your Jira tickets from statuses in config')
        const tickets = await core.jira.getJQLTicketsForCurrentProject(projectConfig.project_id, projectConfig.JQL)
        cli.action.stop()
        this.log('\n')

        const ticketToUse = await ticketSelectionQuestion(tickets, projectConfig.project_key, true)
        const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)

        this.handleTicket(issueBasedOnName, projectConfig.project_id)
      }

      if (parseInt(output.actionValue, 10) === 2) {
        core.jira.configureClientFromConfigFile(authConfig)
        this.log('\n')
        cli.action.start('Fetching all of your Jira tickets for the project')
        const tickets = await core.jira.getAllTicketsAssignedToUserForCurrentProject(projectConfig.project_id)
        cli.action.stop()
        this.log('\n')

        const ticketToUse = await ticketSelectionQuestion(tickets, projectConfig.project_key, true)
        const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)

        this.handleTicket(issueBasedOnName, projectConfig.project_id)
      }

      if (parseInt(output.actionValue, 10) === 3) {
        core.jira.configureClientFromConfigFile(authConfig)
        this.log('\n')
        cli.action.start('Fetching all Jira tickets for project')
        const tickets = await core.jira.getAllTicketsForCurrentProject(projectConfig.project_id)
        cli.action.stop()
        this.log('\n')

        const ticketToUse = await ticketSelectionQuestion(tickets, projectConfig.project_key, true)
        const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)

        this.handleTicket(issueBasedOnName, projectConfig.project_id)
      }

      if (parseInt(output.actionValue, 10) === 4) {
        this.log(chalk.yellow('\nUnfortunately this is still work in progress. Should be in soon\n'))
      }

      if (parseInt(output.actionValue, 10) === 5) {
        this.log(chalk.green('\nAll done :)\n'))
      }

      return
    }

    // Setup authentication to Jira if not setup
    // We reach here if auth config is missing or user triggers cfy -a (cfy --auth)
    if (!authConfig || properties.auth) {
      // If user is running default cfy command, but auth isn't setup yet
      // We log this warning
      if (!properties.auth && !properties.config) {
        this.log(chalk.red("\nSeems like you don't have cfy connected to Jira\n"))
      }

      // If user reaches here without extra flags in the command we ask if they want to setup cfy + jira
      const shouldInitializeProject = properties.auth || properties.config || (await initAuthSetupQuestion()).value

      // If user reaches here due to -a flag, we log that they are about to update they jira auth config
      if (properties.auth) {
        this.log(chalk.red('\nYou are about to update your Jira authentication setup\n'))
      }

      if (shouldInitializeProject) {
        const projectInitConfig = await jiraAuthenticationQuestions()

        // Creates a Jira client instance
        core.jira.configureJiraClient({
          domain: projectInitConfig.domain,
          email: projectInitConfig.email,
          token: projectInitConfig.token,
        })

        // Creates ~/.cfy file and stores Jira auth config
        core.fs.createAndStoreAuthFile({
          domain: projectInitConfig.domain,
          email: projectInitConfig.email,
          token: projectInitConfig.token,
        })

        this.hasDoneAuthConfig = true

        this.log(
          `\nAuthentication is now setup. You can view and edit config file at: ${chalk.blue.bold(
            core.fs.getAuthConfigPath(),
          )}\n`,
        )

        await sleep(500)

        // If we reach here without --auth flag then we re-run the whole command to reach the next step
        if (!properties.auth) {
          this.run()
        } else {
          return
        }
      }
    }

    // Setup connection to Jira project if not setup or triggered with -c (--config)
    if (!!(!projectConfig && authConfig) || properties.config) {
      // If there's no auth created to Jira we ask if users wants to do that instead
      // This mostly should happen if user calls cfy -c without setting up auth before
      if (!authConfig) {
        this.log(chalk.red("\nYou can't update project config without setting up jira auth.\n"))
        const shouldAuth = (await initAuthSetupQuestion()).value

        if (shouldAuth) {
          this.run()
        }
      } else if (this.hasDoneAuthConfig) {
        if (!properties.config) {
          this.log(chalk.red("\nSeems like you don't have cfy set up for the current project\n"))
        }

        // If user has already set up jira auth previously, but is setting up a new project
        // We do a nice thing and ask if they really want to do it
        const shouldSetupProject = properties.config || (await initProjectSetupQuestion()).value

        if (shouldSetupProject) {
          if (properties.config) {
            this.log(chalk.red('\nYou are about to update your project configuration setup'))
          }
          this.setupProjectWithCfy(authConfig)
        }
      } else if (properties.config) {
        this.setupProjectWithCfy(authConfig)
      }
    }

    // Run the actual commit message logic

    if (authConfig && projectConfig && !properties.ticket && !properties.auth && !properties.config) {
      try {
        const stagedFiles = await runCommand('git diff --name-only --cached')

        // If no staged files we show an error and exit
        if (stagedFiles.length === 0) {
          this.log(
            chalk.red.bold(
              '\nYou have no staged changes. Please stage some changes or run "cfy -t" to take actions on tickets without commiting\n',
            ),
          )
        } else {
          this.log(`Staged files:\n`)
          this.log(chalk.green(`${stagedFiles}`))

          await sleep(50)

          core.jira.configureClientFromConfigFile(authConfig)

          cli.action.start('Fetching your Jira tickets')
          const tickets = await core.jira.getJQLTicketsForCurrentProject(projectConfig.project_id, projectConfig.JQL)
          cli.action.stop()

          this.log('\n')

          const ticketToUse = await ticketSelectionQuestion(tickets, projectConfig.project_key)
          const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)
          const ticketAnswer = ticketToUse.ticket
          const commitConfig = await commitTypeQuestion(ticketAnswer.split(' - ')[1])

          const commitMessage = constructCommitMessage(
            ticketAnswer.split(' - ')[0],
            commitConfig.type,
            commitConfig.wip,
            commitConfig.message,
            projectConfig,
          )

          const isUsingAnExistingTicket = Boolean(issueBasedOnName.key)

          try {
            const commit = await runCommand(`git commit -m "${commitMessage}"`)

            this.log(chalk.green(`\n\nCommit successfully created\n`))
            this.log(chalk.green(`\n${commit}\n`))

            await sleep(50)

            if (isUsingAnExistingTicket) {
              this.handleTicketAfterCommit(issueBasedOnName, projectConfig.project_id)
            }
          } catch (error) {
            this.log(`${chalk.red(error)}`)
          }
        }
      } catch (error) {
        this.log(`${chalk.red(error)}`)
      }
    }
  }
}
