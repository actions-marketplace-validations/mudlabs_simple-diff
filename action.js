const core = require("@actions/core");
const github = require("@actions/github");

const unsupportedEvent = name => name !== "pull_request" && name !== "push" ? true : false;
const getBase = name => data => name === "pull_request" ? data.pull_request.base.sha : data.before;
const getHead = name => data => name === "pull_request" ? data.pull_request.head.sha : data.after;
const normalise = path => path.split("/").filter(item => item !== "" && item !== ".").join("/");
const toBoolean = value => value.toLowerCase() == "true";

(async function(){
  try {
    const path = core.getInput("path");
    const token = core.getInput("token");
    const repo = github.context.repo.repo;
    const owner = github.context.repo.owner;
    const event_name = github.context.eventName;
    const strict = toBoolean(core.getInput("strict"));
    const octokit = github.getOctokit(token, { required: true });

    if (unsupportedEvent(event_name)) throw `This event (${event_name}) is unsupported. Simple Diff only supports PUSH and PR events.`;
  
    const base = getBase(event_name)(github.context.payload);
    const head = getHead(event_name)(github.context.payload);
    const response = await octokit.repos.compareCommits({ base, head, owner, repo });
    
    if (response.status !== 200) throw `The API request for this ${github.context.eventName} event returned ${response.status}, expected 200.`;
    if (response.data.status !== "ahead") throw `The head commit for this ${github.context.eventName} event is not ahead of the base commit.`;
    
    const target = normalise(path);
    const files = response.data.files;
    files.forEach(file => console.log(file));
    const file = files.find(file => decodeURIComponent(file.contents_url).indexOf(`contents/${target}`) !== -1);
    
    core.setOutput("added", file ? file.status === "added" : false);
    core.setOutput("modified", file ? file.status === "modified" : false);
    core.setOutput("removed", file ? file.status === "removed" : false);
    core.setOutput("renamed", file ? file.status === "renamed" : false);
    core.setOutput("name", file ? file.filename : target);
    
    if (file) return;
    if (strict) throw `None of the files in this commits diff tree match the provided file (${path}).`;
    console.log(`None of the files in this commits diff tree match the provided file (${path}).`);
           
  } catch (error) {
    core.setFailed(error);
  }
})();
