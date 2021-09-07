import fs from './fs-core'
import jira from './jira-core'

const core: {
  fs: typeof fs
  jira: typeof jira
} = {
  fs,
  jira,
}

export default core
