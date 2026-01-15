We have succesfully create a @scraper.py  that scrapes data from liquidpedia tournament pages, a database_parser.py and a @database_inserter.py  that put this data into supabase. We have succesfully scraped @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

Liquidpedia is build in a way that a tournament page like this, can have multiple sub events. We have succesfully create a scraper that can automaticlkly detect and scrape all event including subevents 

We have created a webinterface for displaying the results/analyses. As descriped in the @readme.md we use react/vite, typescript, ShadCN. 

Next task is to actually display something. 

task is:
1. Lets make a list of all players with thier number of matches, win/loss and teammates 