#!/bin/bash

export GIT_REPOSITORY_URL="$GIT_REPOSITORY_URL"
git clone "$GIT_REPOSITORY_URL" /home/app/output
exec node index.js


# export GIT_REPOSITORY_URL="$GIT_REPOSITORY_URL"
# git clone "$GIT_REPOSITORY_URL" output
# exec node index.js


