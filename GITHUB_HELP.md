# news
Program to store URLs of news articles I find interesting for later reading

Coding on github with 2 different accounts
Don't use --global  --> git config in the cloned directory, see below
git config --global --list


# First create the keys
ssh-keygen -t rsa -b 4096 -C "chrisarends09@gmail.com" -f ~/.ssh/id_rsa_chris
ssh-keygen -t rsa -b 4096 -C "arendsam@oregonstate.edu" -f ~/.ssh/id_rsa_amelia

eval "$(ssh-agent -s)"

ssh-add ~/.ssh/id_rsa_chris
ssh-add ~/.ssh/id_rsa_amelia
ssh-add -l

# Add the keys to respective github accounts
cat ~/.ssh/id_rsa_chris.pub
cat ~/.ssh/id_rsa_amelia.pub

# ################################################
# Create a config file
ls -la ~/.ssh
nano ~/.ssh/config

Host github.com-chrisarends09
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_chris

Host github.com-arends2005
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_amelia
# ###############################################

# Clone into local host machine
git clone git@github.com-arends2005:arends2005/news.git
# Add git info into the local folder
git config user.name "arends2005"
git config user.email "arendsam@oregonstate.edu"

git config --local --list