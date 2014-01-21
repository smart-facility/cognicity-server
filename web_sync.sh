#!/bin/bash

# Script
# © Matthew Berryman 2014

# 1st command line parameter = base name for web instances.
# 2nd command line parameter = number of web instances

# Set this to the list of files to be synced:
FILES=test

i=0
while [ $i -lt $2 ]; do
    rsync -av FILES $1$i
    let i=i+1
done



