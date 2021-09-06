/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-negated-condition */
import cli from 'cli-ux'
import chalk from 'chalk'
import { exec } from 'child_process'
import inquirer = require('inquirer')
import { Command } from '@oclif/command'

import core from '../core/core'
import { commitTypeQuestion } from '../flows/commit-flow'
import {
  JQLQuestion,
  initAuthSetupQuestion,
  ticketSelectionQuestion,
  initProjectSetupQuestion,
  projectSelectionQuestion,
  jiraAuthenticationQuestions,
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

  hasDoneAuthConfig = false

  async setupProjectWithCfy(authConfig: AuthConfigType): Promise<void> {
    core.jira.configureClientFromConfigFile(authConfig)
    console.log('\n')
    cli.action.start('Fetching Jira projects')
    const jiraProjects = await core.jira.getProjectsForAccount()
    cli.action.stop()
    console.log('\n')

    const projectSettings = await projectSelectionQuestion(jiraProjects)

    console.log(chalk.yellow("\nNow it's going to be a bit more complicated\n"))
    console.log('To filter out relevant tickets from the project, you need to create a JQL\n')

    console.log(
      `1. Please navigate to: ${chalk.blue.bold('https://colorfy.atlassian.net/issues/?jql=order+by+created+DESC')}`,
    )

    console.log(
      `2. Choose ${chalk.yellow.bold(
        "'Switch to basic'",
      )} from the right side, and select all relevant options for you (e.g. Project, Status, and assignee)'`,
    )

    console.log(
      `3. After that switch back to JQL from the right side, and you should see something like: ${chalk.yellow.bold(
        'project = PROJECT_NAME AND status in (Backlog, "In Progress", "On Hold", "Selected for Development", "To Do") AND assignee in (USER_ID) order by created DESC',
      )}`,
    )

    console.log(
      `4. COPY ONLY THE FOLLOWING PART IN THE FOLLOWING INPUT: ${chalk.green.bold(
        'status in (Backlog, "In Progress", "On Hold", "Selected for Development", "To Do")',
      )}\n`,
    )

    const JQLForTickets = await JQLQuestion()
    const projectNameToUse = projectSettings.projectName

    const projectJQLToUse = JQLForTickets.JQL
    const jiraProject = jiraProjects.filter(project => `${project.key} - ${project.name}` === projectNameToUse)[0]

    core.fs.createAndStoreConfigFile({
      projectKey: jiraProject.key!,
      JQL: projectJQLToUse,
    })

    setTimeout(() => {
      this.run()
    }, 500)
  }

  async run(): Promise<void> {
    const authConfig = core.fs.getAuthConfig()
    const projectConfig = core.fs.getProjectConfig()

    // Setup authentication to Jira if not setup
    if (!authConfig) {
      const shouldInitializeProject = (await initAuthSetupQuestion()).value

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

        setTimeout(() => {
          this.run()
        }, 500)
      }
    }

    // Setup Jira project if not setup

    if (!projectConfig && authConfig) {
      // If user has already set up jira auth previously, but is setting up a new project
      // We do a nice thing and ask if ther really want to do it
      if (!this.hasDoneAuthConfig) {
        const shouldSetupProject = (await initProjectSetupQuestion()).value

        if (shouldSetupProject) {
          this.setupProjectWithCfy(authConfig)
        }
      } else {
        this.setupProjectWithCfy(authConfig)
      }
    }

    // Run the actual commit message logic

    if (authConfig && projectConfig) {
      core.jira.configureClientFromConfigFile(authConfig)
      const projectKey = projectConfig.project_key
      console.log('\n')
      cli.action.start('Fetching your Jira tickets')
      const jiraProjects = await core.jira.getProjectsForAccount()
      const jiraProject = jiraProjects.filter(project => project.key === projectKey)[0]
      const projectID = jiraProject.id!
      const tickets = await core.jira.getTicketsForCurrentProject(projectID, projectConfig.JQL)
      cli.action.stop()
      console.log('\n')

      const ticketToUse = await ticketSelectionQuestion(tickets, jiraProject.key!)
      const ticketAnswer = ticketToUse.ticket
      const commitConfig = await commitTypeQuestion(ticketAnswer.split(' - ')[1])

      const commitMessage = constructCommitMessage(
        ticketAnswer.split(' - ')[0],
        commitConfig.type,
        commitConfig.wip,
        commitConfig.message,
      )

      exec(`git commit -m "${commitMessage}"`, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`)
          return
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`)
          return
        }
        console.log(`stdout: ${stdout}`)
      })
    }
  }
}
