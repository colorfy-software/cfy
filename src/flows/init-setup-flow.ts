import chalk from 'chalk'
import { prompt } from 'inquirer'
import { IssuePickerSuggestions, Project } from 'jira.js/out/version2/models'

import { validateEmail } from '../utils/validation'

export const initAuthSetupQuestion = async (): Promise<{ value: boolean }> => {
  console.log(chalk.red("\nSeems like you don't have cfy connected to Jira\n"))

  const output = await prompt([
    {
      type: 'confirm',
      name: 'value',
      message: 'Do you want to setup the project to use cfy?',
      default: true,
    },
  ])

  return output
}

export const initProjectSetupQuestion = async (): Promise<{ value: boolean }> => {
  console.log(chalk.red("\nSeems like you don't have cfy set up for the current project\n"))

  const output = await prompt([
    {
      type: 'confirm',
      name: 'value',
      message: 'Do you want to setup cfy for the current project?',
      default: true,
    },
  ])

  return output
}

export const jiraAuthenticationQuestions = async (): Promise<{
  domain: string
  email: string
  token: string
}> => {
  console.log(chalk.yellow('\nWe need to get some data from you to setup connection with Jira\n'))

  const output = await prompt([
    {
      type: 'input',
      name: 'domain',
      message: 'Enter your JIRA Domain (eg. [domain].atlassian.net)',
      validate(value) {
        if (value.length === 0) {
          return 'Sorry, you need to enter your JIRA Domain for this to work'
        }

        return true
      },
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter your JIRA Account email',
      validate(value) {
        const isValidEmail = validateEmail(value)

        if (!isValidEmail) {
          return 'Sorry, this is not a valid email format'
        }

        return true
      },
    },
    {
      type: 'input',
      name: 'token',
      message: `Enter your JIRA Account API Token. (Generate it at url: ${chalk.blue.bold(
        'https://id.atlassian.com/manage-profile/security/api-tokens',
      )})`,
      validate(value) {
        if (value.length === 0) {
          return 'Sorry, you need to enter something here'
        }
        return true
      },
    },
  ])

  return output
}

export const projectSelectionQuestion = async (projects: Project[]): Promise<{ projectName: string }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'projectName',
      message: 'Choose which project you want to set as default. That project will be used to fetch tickets',
      choices: projects.map(project => `${project.key} - ${project.name}`),
    },
  ])

  return output
}

export const JQLQuestion = async (): Promise<{ JQL: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'JQL',
      message: 'JQL for tickets',
      validate(value) {
        if (value.length === 0) {
          return 'Sorry, you need to enter something here'
        }
        return true
      },
    },
  ])

  return output
}

export const ticketSelectionQuestion = async (
  issues: IssuePickerSuggestions,
  projectKey: string,
): Promise<{ ticket: string }> => {
  const sections = issues.sections && issues.sections[0]
  const availableIssues = (sections ? sections.issues?.map(issue => `${issue.key} - ${issue.summary}`) : []) || []
  const choices = [`${projectKey} - !! Move on without a ticket number !!`, ...availableIssues]

  const output = await prompt([
    {
      type: 'search-list',
      name: 'ticket',
      message: 'Choose which ticket you want to connect the commit to',
      choices,
    },
  ])

  return output
}
