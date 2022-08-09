import chalk from 'chalk'
import { prompt } from 'inquirer'
import { Project, SearchResults } from 'jira.js/out/version2/models'

import { validateEmail } from '../utils/validation'

export const initAuthSetupQuestion = async (): Promise<{ value: boolean }> => {
  const output = await prompt([
    {
      type: 'confirm',
      name: 'value',
      message: 'Do you want to connect Jira to cfy?',
      default: true,
    },
  ])

  return output
}

export const initContinueToCommitting = async (): Promise<{ value: boolean }> => {
  const output = await prompt([
    {
      type: 'confirm',
      name: 'value',
      message: 'Do you want to commit your current progress?',
      default: true,
    },
  ])

  return output
}

export const initProjectSetupQuestion = async (): Promise<{ value: boolean }> => {
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

export const getStatusesForProject = async (statuses: string[]): Promise<{ statusSelections: string[] }> => {
  const output = await prompt([
    {
      type: 'checkbox',
      name: 'statusSelections',
      message: 'Statuses for tickets',
      choices: statuses,
    },
  ])

  return output
}

export const chooseTypeForIssue = async (types: string[]): Promise<{ typeSelections: string }> => {
  const output = await prompt([
    {
      type: 'list',
      name: 'typeSelections',
      message: 'Choose type for issue',
      choices: types,
    },
  ])

  return output
}

export const chooseLabelForIssue = async (labels: string[]): Promise<{ labelSelections: string }> => {
  const output = await prompt([
    {
      type: 'list',
      name: 'labelSelections',
      message: 'Choose label for issue',
      choices: labels,
    },
  ])

  return output
}

export const ticketSelectionQuestion = async (
  issues: SearchResults,
  projectKey: string,
  hideEmptyTicket?: boolean | undefined,
): Promise<{ ticket: string }> => {
  // const sections = issues.sections && issues.sections[0]
  const availableIssues =
    issues.issues?.map(issue => {
      return {
        name: `${issue.key} - ${issue.fields.summary}`,
      }
    }) || []

  const choices = hideEmptyTicket
    ? availableIssues
    : [
        {
          name: `Create new issue`,
        },
        ...availableIssues,
      ]

  const output = await prompt([
    {
      type: 'search-list',
      name: 'ticket',
      message: hideEmptyTicket
        ? 'Choose which ticket you want to take an action on'
        : 'Choose which ticket you want to connect the commit to',
      choices,
    },
  ])

  return output
}

export const searchForTicketQuestion = async (): Promise<{ query: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'query',
      message: 'Search query',
    },
  ])

  return output
}

export const issueTitle = async (): Promise<{ title: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Title of the issue',
    },
  ])

  return output
}

export const issueDescription = async (): Promise<{ description: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Description of the issue',
    },
  ])

  return output
}
