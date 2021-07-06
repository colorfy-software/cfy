import chalk from 'chalk'
import { prompt } from 'inquirer'
import { IssuePickerSuggestions, Project } from 'jira.js/out/version2/models'

import { validateEmail } from '../utils/validation'

export const initProjectQuestion = async (): Promise<{ value: boolean }> => {
  console.log(chalk.red("\nSeems like you don't have cfy set up\n"))

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
      message: 'Enter your JIRA Account API Token. (Generate it in your Atlassian account settings)',
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

export const projectSelectionQuestion = async (projects: Project[]): Promise<{ projectName: string; JQL: string }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'projectName',
      message: 'Choose which project you want to set as default. That project key will be used in the commit message',
      choices: projects.map(project => `${project.key} - ${project.name}`),
    },
    {
      type: 'input',
      name: 'JQL',
      message:
        // eslint-disable-next-line no-template-curly-in-string
        'For filtering out projects that only you care about, please go to JIRA advanced search (https://colorfy.atlassian.net/issues/?jql=order+by+created+DESC), choose basic instead of JQL, set all of the filtering to which tickets you want to see. Switch back to JQL and copy the output here. It should look something like: \n "project = LOVE AND status in (Backlog, "In Progress", "On Hold", "Selected for Development", "To Do") AND assignee in (5b0583f9a06f955a6694695f)".\nPaste ONLY this part in here: "status in (Backlog, "In Progress", "On Hold", "Selected for Development", "To Do")"',
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
