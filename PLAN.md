# Class sorting application

An application for teachers to organise their classes into new classes for the following year based on various parameters and rules, such as not being able to place children together and aiming to appease preferred friends.

## Requirements

- A Portable, standalone desktop application built with Electron
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
- Optional "must be with" child (strict pair, hard sort constraint)
- Gender (Male or Female)
- EAL (English as an additional Language) - *A boolean*
- Behavior rank (1-3)
- Ability rank (1-3)
- EHCP - *A boolean*
- SEND - *A boolean*
- PPG - *A boolean*

## Implemented Features

### Students Tab

- **CSV Import**: Import students from CSV files with automatic column detection for name, gender, EAL, behavior, ability, EHCP/SEND/PPG, preferred friends, and blacklisted students
- **CSV Export**: Export the raw student list to CSV for backup or transferring between machines (compatible with the import format)
- **Add/Edit Students**: Modal forms for adding new students and editing existing ones with full property support
- **Must-Be-With Pairing**: Optional strict 1:1 student pairing that sorting treats as a hard constraint
- **Inline Editing**: Gender and EAL properties can be quickly toggled by clicking directly on the badges in the student table
  - Click the M/F badge to toggle between Male and Female
  - Click the Yes/No badge to toggle EAL status
  - Click behavior/ability badges to cycle between ranks 1, 2, and 3
  - Click EHCP/SEND/PPG badges to toggle Yes/No

### Results Tab

- **Drag and Drop**: Move students between classes by dragging, with automatic blacklist violation detection
- **Friends Tooltip**: Hover over any student to see their preferred friends, with visual indicators showing which friends are in the same class (green) vs different classes (gray)
- **PDF Export**: Export includes preferred friends list for each student, with matched friends highlighted in green
