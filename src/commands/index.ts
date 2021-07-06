/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-negated-condition */
import cli from 'cli-ux'
import { exec } from 'child_process'
import inquirer = require('inquirer')
import { Command } from '@oclif/command'

import core from '../core/core'
import { commitTypeQuestion } from '../flows/commit-flow'
import {
  initProjectQuestion,
  jiraAuthenticationQuestions,
  projectSelectionQuestion,
  ticketSelectionQuestion,
} from '../flows/init-setup-flow'

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

  async run(): Promise<void> {
    const authConfig = core.fs.getAuthConfig()
    const projectConfig = core.fs.getProjectConfig()
    // Setup authentication to Jira if not setup
    if (!authConfig) {
      const shouldInitializeProject = (await initProjectQuestion()).value

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

        setTimeout(() => {
          this.run()
        }, 500)
      }
    }

    // Setup Jira project if not setup
    if (!projectConfig && authConfig) {
      core.jira.configureClientFromConfigFile(authConfig)
      cli.action.start('Fetching Jira projects')
      const jiraProjects = await core.jira.getProjectsForAccount()
      cli.action.stop()
      const projectSettings = await projectSelectionQuestion(jiraProjects)
      const projectNameToUse = projectSettings.projectName
      const projectJQLToUse = projectSettings.JQL
      const jiraProject = jiraProjects.filter(project => `${project.key} - ${project.name}` === projectNameToUse)[0]

      core.fs.createAndStoreConfigFile({
        projectKey: jiraProject.key!,
        JQL: projectJQLToUse,
      })

      setTimeout(() => {
        this.run()
      }, 500)
    }

    // Run the actual commit message logic
    if (authConfig && projectConfig) {
      core.jira.configureClientFromConfigFile(authConfig)
      const projectKey = projectConfig.project_key
      cli.action.start('Fetching your Jira tickets')
      const jiraProjects = await core.jira.getProjectsForAccount()
      const jiraProject = jiraProjects.filter(project => project.key === projectKey)[0]
      const projectID = jiraProject.id!
      const tickets = await core.jira.getTicketsForCurrentProject(projectID, projectConfig.JQL)
      cli.action.stop()
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
