/* eslint-disable complexity */
/* eslint-disable no-implicit-coercion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-negated-condition */
import cli from 'cli-ux'
import chalk from 'chalk'
import { exec } from 'child_process'
import inquirer = require('inquirer')
import { Command, flags } from '@oclif/command'
import { IssueBean } from 'jira.js/out/version2/models'
import { SuggestedIssue } from 'jira.js/out/version2/models/suggestedIssue'

import core from '../core/core'
import sleep from '../utils/sleep'
import { addCommentToIssueInput, commitTypeQuestion, whatToDoWithIssue } from '../flows/commit-flow'
import {
  getStatusesForProject,
  initAuthSetupQuestion,
  ticketSelectionQuestion,
  initProjectSetupQuestion,
  projectSelectionQuestion,
  jiraAuthenticationQuestions,
  initContinueToCommitting,
} from '../flows/init-setup-flow'

import { AuthConfigType } from '../types/types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
inquirer.registerPrompt('search-list', require('inquirer-search-list'))

const constructCommitMessage = (ticketNumber: string, commitType: string, wip: boolean, message: string) => {
  const prefix = `[${ticketNumber}${wip ? ' | WIP' : ''}]`
  const type = `- ${commitType.toUpperCase()}`

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
    core.jira.configureClientFromConfigFile(authConfig)
    console.log('\n')
    cli.action.start('Fetching Jira projects')
    const jiraProjects = await core.jira.getProjectsForAccount()
    cli.action.stop()
    console.log('\n')

    const projectSettings = await projectSelectionQuestion(jiraProjects)

    console.log(chalk.yellow('\nNow we need to filter out correct tickets from all of the statuses\n'))

    const projectNameToUse = projectSettings.projectName
    const jiraProject = jiraProjects.filter(project => `${project.key} - ${project.name}` === projectNameToUse)[0]
    const availableStatuses = await core.jira.getAllStatusesForProject(jiraProject.id!)
    const selectedStatuses = await getStatusesForProject(availableStatuses)

    const JQLString = selectedStatuses.statusSelections.reduce((accumulator, currentValue, index, array) => {
      if (currentValue.split(' ').length > 1) {
        accumulator += `"${currentValue}"`
      } else {
        accumulator += `${currentValue}`
      }

      if (array.length - 1 === index) {
        accumulator += ')'
      } else {
        accumulator += `, `
      }

      return accumulator
    }, 'status in (')

    core.fs.createAndStoreConfigFile({
      projectId: jiraProject.id!,
      projectKey: jiraProject.key!,
      JQL: JQLString,
    })

    await sleep(500)

    console.log(chalk.green.bold("\nYou're all setup to use cfy now :)\n"))

    const shouldContinue = await initContinueToCommitting()

    if (shouldContinue.value) {
      this.run()
    }
  }

  async handleTicketAfterCommit(issue: SuggestedIssue | IssueBean, projectID: string): Promise<void> {
    const currentIssue = await core.jira.getIssueBasedOnIdOrKey(issue.key!)
    const whatNext = await whatToDoWithIssue()

    if (whatNext.next === 1) {
      const ticketKey = currentIssue.key!
      const comment = (await addCommentToIssueInput()).comment
      console.log('\n')
      cli.action.start('Adding comment to the ticket')
      await core.jira.addCommentToIssue(ticketKey, comment)
      cli.action.stop()
      console.log('\n')

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (whatNext.next === 2) {
      // Move ticket to new column
      await core.jira.moveIssueToNewStatus(currentIssue.id!, projectID)

      sleep(50)
      this.handleTicketAfterCommit(currentIssue, projectID)
    }

    if (whatNext.next === 3) {
      this.log(chalk.green('\nAll done :)\n'))
    }
  }

  async run(): Promise<void> {
    const { flags: properties } = this.parse(Create)
    const authConfig = core.fs.getAuthConfig()
    const projectConfig = core.fs.getProjectConfig()

    if (properties.ticket && authConfig && projectConfig) {
      this.log('\n')

      core.jira.configureClientFromConfigFile(authConfig)
      const projectKey = projectConfig.project_key
      cli.action.start('Fetching your Jira tickets')
      const jiraProjects = await core.jira.getProjectsForAccount()
      const jiraProject = jiraProjects.filter(project => project.key === projectKey)[0]
      const projectID = jiraProject.id!

      const tickets = await core.jira.getTicketsForCurrentProject(projectID, projectConfig.JQL)
      cli.action.stop()
      console.log('\n')

      const ticketToUse = await ticketSelectionQuestion(tickets, jiraProject.key!, true)
      const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)

      this.handleTicketAfterCommit(issueBasedOnName, projectID)
    }

    // Setup authentication to Jira if not setup
    if (!authConfig || properties.auth) {
      if (!properties.auth && !properties.config) {
        console.log(chalk.red("\nSeems like you don't have cfy connected to Jira\n"))
      }

      const shouldInitializeProject = properties.auth || properties.config || (await initAuthSetupQuestion()).value

      if (properties.auth) {
        console.log(chalk.red('\nYou are about to update your Jira authentication setup\n'))
      }

      if (shouldInitializeProject) {
        const projectInitConfig = await jiraAuthenticationQuestions()

        core.jira.configureJiraClient({
          domain: projectInitConfig.domain,
          email: projectInitConfig.email,
          token: projectInitConfig.token,
        })

        core.fs.createAndStoreAuthFile({
          domain: projectInitConfig.domain,
          email: projectInitConfig.email,
          token: projectInitConfig.token,
        })

        this.hasDoneAuthConfig = true

        console.log(
          `\nAuthentication is now setup. You can view and edit config file at: ${chalk.blue.bold(
            core.fs.getAuthConfigPath(),
          )}\n`,
        )

        await sleep(500)

        if (!properties.auth) {
          this.run()
        } else {
          return
        }
      }
    }

    // Setup Jira project if not setup

    if ((!projectConfig && authConfig) || properties.config) {
      // If user has already set up jira auth previously, but is setting up a new project
      // We do a nice thing and ask if they really want to do it

      if (!authConfig) {
        console.log(chalk.red("\nYou can't update project config without setting up jira auth.\n"))
        const shouldAuth = (await initAuthSetupQuestion()).value

        if (shouldAuth) {
          this.run()
        }
      } else if (!this.hasDoneAuthConfig) {
        if (!properties.config) {
          console.log(chalk.red("\nSeems like you don't have cfy set up for the current project\n"))
        }

        const shouldSetupProject = properties.config || (await initProjectSetupQuestion()).value

        if (shouldSetupProject) {
          if (properties.config) {
            console.log(chalk.red('\nYou are about to update your project configuration setup'))
          }
          this.setupProjectWithCfy(authConfig)
        }
      } else if (properties.config) {
        this.setupProjectWithCfy(authConfig)
      }
    }

    // Run the actual commit message logic

    if (authConfig && projectConfig && !properties.ticket && !properties.auth && !properties.config) {
      exec(`git diff --name-only --cached`, async (gitDiffError, gitDiffStdout, gitDiffStderr) => {
        if (gitDiffError) {
          this.log(`${chalk.red(gitDiffError.message)}`)
          return
        }

        if (gitDiffStderr) {
          this.log(`${chalk.red(gitDiffStderr)}`)
          return
        }

        if (gitDiffStdout.length === 0) {
          this.log(
            chalk.red.bold(
              '\nYou have no staged changes. Please stage some changes or run "cfy -t" to take actions on tickets without commiting\n',
            ),
          )
        } else {
          this.log(`Staged files:\n`)
          this.log(chalk.green(`${gitDiffStdout}`))

          await sleep(50)

          core.jira.configureClientFromConfigFile(authConfig)
          const projectKey = projectConfig.project_key
          cli.action.start('Fetching your Jira tickets')
          const jiraProjects = await core.jira.getProjectsForAccount()
          const jiraProject = jiraProjects.filter(project => project.key === projectKey)[0]
          const projectID = jiraProject.id!

          const tickets = await core.jira.getTicketsForCurrentProject(projectID, projectConfig.JQL)
          cli.action.stop()
          console.log('\n')

          const ticketToUse = await ticketSelectionQuestion(tickets, jiraProject.key!)
          const issueBasedOnName = core.jira.getIssuesBasedOnName(tickets, ticketToUse)

          const ticketAnswer = ticketToUse.ticket
          const commitConfig = await commitTypeQuestion(ticketAnswer.split(' - ')[1])

          const commitMessage = constructCommitMessage(
            ticketAnswer.split(' - ')[0],
            commitConfig.type,
            commitConfig.wip,
            commitConfig.message,
          )

          const isUsingAnExistingTicket = Boolean(issueBasedOnName.key)

          exec(`git commit -m "${commitMessage}"`, async (error, stdout, stderr) => {
            if (error) {
              this.log(`${chalk.red(error.message)}`)
              return
            }

            if (stderr) {
              this.log(`${chalk.red(stderr)}`)
              return
            }

            this.log(chalk.green(`\n\nCommit successfully created\n`))
            this.log(chalk.green(`\n${stdout}\n`))

            await sleep(50)

            if (isUsingAnExistingTicket) {
              this.handleTicketAfterCommit(issueBasedOnName, projectID)
            }
          })
        }
      })
    }
  }
}
