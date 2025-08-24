# Escalier Counter

Escalier Counter is a web-based application to manage and track scores for the card game "Escalier" (UpDown). It provides an intuitive interface for entering bids, tricks, and automatically calculates scores, including advanced rules like optional abandons and direction changes.

## Features

- **Dynamic Player Setup**: Supports 3 to 6 players with customizable names.
- **Configurable Abandons**: Choose the number of allowed abandons per player (0, 1, 3, or 5 for ascent/descent), or disable them entirely.
- **Bonus Option**: Activate the special "perfection bonus" for players who abandon 10 rounds and succeed most of their contracts.
- **Direction Change**: Players can reverse the distribution direction (clockwise/counter-clockwise) by spending abandons, with a single reversal allowed per round.
- **Strict Rule Enforcement**: The app ensures only one player can abandon per round, and never allows fewer than two active players in a round. Only one direction change per round is possible.
- **Undo Last Round**: Cancel and correct the last round, restoring all scores, abandon counts, and direction.
- **Score Tracking**: Automatically calculates scores based on bids and tricks, including all penalties and bonuses.
- **Game State Persistence**: Save and resume games using local storage.
- **PDF Export**: Generate a detailed game summary in PDF format, including tables and charts.
- **Charts**: Visualize score evolution and contract performance.
- **Dark Mode**: Toggle between light and dark themes.
- **Test/Debug Tools**: Create a test game and auto-fill scores for quick testing.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/escalier-counter.git
   ```
2. Navigate to the project directory:
   ```bash
   cd escalier-counter
   ```
3. Open `index.html` in your browser to start the application.

## Usage

1. **Setup**:
   - Select the number of players (3-6).
   - Enter player names.
   - Choose the number of abandons allowed per player (or none).
   - Optionally activate the "Bonus de Perfection" if using 5 abandons.
   - Click "Commencer" to start the game.

2. **Gameplay**:
   - Input bids during the bidding phase.
   - Only one player can abandon per round, and only if at least two players remain active.
   - Players can check the "Inverser" box to reverse the distribution direction (costs 2 or 3 abandons, the latter also counts as an abandon).
   - Input tricks during the tricks phase.
   - Scores, abandon counts, and direction are updated automatically.
   - Use "Corriger" to undo the last round if needed.

3. **End Game**:
   - View the final scores, bonus points, and charts.
   - Export the game summary as a PDF.

4. **Other Features**:
   - Use the "Mode Sombre" button to toggle between light and dark themes.
   - Use the "Créer une Partie Test" and "Remplir Scores Automatiquement" buttons for quick testing.

### Test/Debug Mode

To access the test mode and quickly simulate a game:

- **Reveal the Test Buttons**:  
  By default, the "Créer une Partie Test" and "Remplir Scores Automatiquement" buttons are hidden.  
  To reveal them, click **three times** on the "Nouvelle Partie" title (with the gear icon) and **two times** on the main title ("Jeu de l'Escalier" with the chart icon) at the top of the page.  
  The test buttons will then appear below the main title.

- **Create a Test Game**:  
  Click "Créer une Partie Test" to instantly set up a 4-player game with sample names and a short sequence of rounds.

- **Auto-Fill Scores**:  
  During a test game, click "Remplir Scores Automatiquement" to fill in random bids and tricks for the current round.  
  This allows you to quickly advance through the game and test the full workflow, including end-of-game summaries and PDF export.

These features are intended for development, demonstration, or debugging purposes.

## Development

### Prerequisites

- A modern web browser (e.g., Chrome, Firefox).
- Basic knowledge of HTML, CSS, and JavaScript for customization.

### File Structure

- `index.html`: Main HTML file.
- `style.css`: Styles for the application.
- `script.js`: JavaScript logic for the game.
- `rules.html`: Game rules and app feature explanations.
- `readme.md`: Project documentation.

### Libraries Used

- [Chart.js](https://www.chartjs.org/): For creating charts.
- [jsPDF](https://github.com/parallax/jsPDF): For generating PDF exports.
- [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable): For tables in PDF.
- [Font Awesome](https://fontawesome.com/): For icons.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests to improve the project.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

- Inspired by the card game "Escalier" / "UpDown".
- Special thanks to the developers of the libraries used in this project.