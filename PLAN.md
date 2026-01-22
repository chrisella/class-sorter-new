# Class sorting application

An application for teachers to organise their classes into new classes for the following year based on various parameters and rules, such as not being able to place children together and aiming to appease preferred friends.

## Requirements

- A Portable, standalone application, ideally something like Electron or similar alternatives, however if there is something better suited then that can be considered
- Allow a user to easily input tabular data about all the children and each ones properties
- Allow a user to easily modify already input data
- Once valid class permutations are calculated and displayed to the user, they should be able to manually move children between classes if they see situations that can't exist
- Should show how well placed each child is in the final class displays, based on their parameters
- Show statistics on the classes based on the children parameters 

## Data Formats

### Class

A collection of children after calculating a valid permutation

### Child

Each child has the following properties:

- Name
- 3 preferred friends to be placed with
- Blacklisted children they should not be placed with under any circumstances
- Gender (Male or Female)
- EAL (English as an additional Language) - *A boolean*