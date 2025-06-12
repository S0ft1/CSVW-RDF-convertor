import { IssueTracker } from "./issue-tracker.js";



export function trimUrl(value:string, templateUrl:string, columnName:string, issueTracker:IssueTracker): string {
    const matches = [...templateUrl.matchAll(/{(.*?)}/g)].map(match => match[1]);
    let foundIndex = matches.indexOf(columnName);
    if(foundIndex==-1){
        issueTracker.addWarning(`The column "${columnName}" is not found in the template URL "${templateUrl}".`);
        return value
    }
    const foundTemplateValue = "{" + matches[foundIndex]+ "}"  ;
    value = value.split('<').join('')
    value = value.split('>').join('')
    const templateName = foundTemplateValue.slice(1, -1);

  // Convert template into a regex with capture groups
  // Replace {param} with (.+?), but mark the one we want with a named capture
  const regexPattern = templateUrl.replace(/\{([^}]+)\}/g, (_, name) =>
    name === templateName ? `(?<${name}>[^/]+)` : `[^/]+`
  );

  const regex = new RegExp(`^${regexPattern}$`);
  const match = value.match(regex);
  let result = match?.groups?.[templateName] ?? null;
  if(result){
    return result;
  }
  else{
    issueTracker.addWarning(`The value "${value}" does not match the template URL "${templateUrl}" for column "${columnName}".`);
    return value;
  }
}

