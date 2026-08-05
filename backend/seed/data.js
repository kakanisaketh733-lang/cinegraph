// 40 movies across 10 directors, hand-picked so the graph is genuinely
// connected: repeated director/actor pairings (Nolan/Caine, Scorsese/DiCaprio,
// Coppola/Duvall, etc.) and actors who cross between directors (DiCaprio,
// Matt Damon, Harrison Ford, Sigourney Weaver...) so six-degrees, hidden
// co-stars, and recommendations all turn up real results.

const movies = [
  // --- Christopher Nolan ---
  { title: 'Inception', year: 2010, directors: ['Christopher Nolan'], genres: ['Sci-Fi', 'Action', 'Thriller'],
    cast: ['Leonardo DiCaprio', 'Tom Hardy', 'Cillian Murphy', 'Michael Caine'] },
  { title: 'The Dark Knight', year: 2008, directors: ['Christopher Nolan'], genres: ['Action', 'Crime', 'Drama'],
    cast: ['Christian Bale', 'Michael Caine', 'Heath Ledger', 'Gary Oldman'] },
  { title: 'Interstellar', year: 2014, directors: ['Christopher Nolan'], genres: ['Sci-Fi', 'Adventure', 'Drama'],
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Michael Caine', 'Jessica Chastain'] },
  { title: 'Dunkirk', year: 2017, directors: ['Christopher Nolan'], genres: ['War', 'Action', 'Drama'],
    cast: ['Tom Hardy', 'Cillian Murphy', 'Mark Rylance', 'Kenneth Branagh'] },
  { title: 'Batman Begins', year: 2005, directors: ['Christopher Nolan'], genres: ['Action', 'Crime', 'Drama'],
    cast: ['Christian Bale', 'Michael Caine', 'Liam Neeson', 'Katie Holmes'] },
  { title: 'The Prestige', year: 2006, directors: ['Christopher Nolan'], genres: ['Drama', 'Mystery', 'Thriller'],
    cast: ['Christian Bale', 'Michael Caine', 'Hugh Jackman', 'Scarlett Johansson'] },

  // --- Martin Scorsese ---
  { title: 'Goodfellas', year: 1990, directors: ['Martin Scorsese'], genres: ['Crime', 'Drama', 'Biography'],
    cast: ['Robert De Niro', 'Ray Liotta', 'Joe Pesci', 'Lorraine Bracco'] },
  { title: 'The Departed', year: 2006, directors: ['Martin Scorsese'], genres: ['Crime', 'Drama', 'Thriller'],
    cast: ['Leonardo DiCaprio', 'Matt Damon', 'Jack Nicholson', 'Mark Wahlberg'] },
  { title: 'The Wolf of Wall Street', year: 2013, directors: ['Martin Scorsese'], genres: ['Crime', 'Drama', 'Biography'],
    cast: ['Leonardo DiCaprio', 'Jonah Hill', 'Margot Robbie', 'Matthew McConaughey'] },
  { title: 'Shutter Island', year: 2010, directors: ['Martin Scorsese'], genres: ['Mystery', 'Thriller', 'Drama'],
    cast: ['Leonardo DiCaprio', 'Mark Ruffalo', 'Ben Kingsley', 'Michelle Williams'] },
  { title: 'Gangs of New York', year: 2002, directors: ['Martin Scorsese'], genres: ['Crime', 'Drama'],
    cast: ['Leonardo DiCaprio', 'Daniel Day-Lewis', 'Cameron Diaz', 'Jim Broadbent'] },

  // --- James Cameron ---
  { title: 'Titanic', year: 1997, directors: ['James Cameron'], genres: ['Drama', 'Romance', 'Adventure'],
    cast: ['Leonardo DiCaprio', 'Kate Winslet', 'Billy Zane', 'Kathy Bates'] },
  { title: 'Avatar', year: 2009, directors: ['James Cameron'], genres: ['Sci-Fi', 'Action', 'Adventure'],
    cast: ['Sam Worthington', 'Zoe Saldana', 'Sigourney Weaver', 'Stephen Lang'] },
  { title: 'Terminator 2: Judgment Day', year: 1991, directors: ['James Cameron'], genres: ['Sci-Fi', 'Action', 'Thriller'],
    cast: ['Arnold Schwarzenegger', 'Linda Hamilton', 'Robert Patrick', 'Edward Furlong'] },
  { title: 'Aliens', year: 1986, directors: ['James Cameron'], genres: ['Sci-Fi', 'Action', 'Thriller'],
    cast: ['Sigourney Weaver', 'Michael Biehn', 'Bill Paxton', 'Carrie Henn'] },

  // --- Steven Spielberg ---
  { title: 'Jurassic Park', year: 1993, directors: ['Steven Spielberg'], genres: ['Sci-Fi', 'Adventure', 'Thriller'],
    cast: ['Sam Neill', 'Laura Dern', 'Jeff Goldblum', 'Richard Attenborough'] },
  { title: 'Jaws', year: 1975, directors: ['Steven Spielberg'], genres: ['Thriller', 'Adventure', 'Horror'],
    cast: ['Roy Scheider', 'Robert Shaw', 'Richard Dreyfuss'] },
  { title: 'E.T. the Extra-Terrestrial', year: 1982, directors: ['Steven Spielberg'], genres: ['Sci-Fi', 'Adventure', 'Drama'],
    cast: ['Henry Thomas', 'Drew Barrymore', 'Dee Wallace'] },
  { title: "Schindler's List", year: 1993, directors: ['Steven Spielberg'], genres: ['Drama', 'War', 'Biography'],
    cast: ['Liam Neeson', 'Ben Kingsley', 'Ralph Fiennes'] },
  { title: 'Saving Private Ryan', year: 1998, directors: ['Steven Spielberg'], genres: ['War', 'Drama', 'Action'],
    cast: ['Tom Hanks', 'Matt Damon', 'Tom Sizemore', 'Edward Burns'] },

  // --- Quentin Tarantino ---
  { title: 'Pulp Fiction', year: 1994, directors: ['Quentin Tarantino'], genres: ['Crime', 'Drama'],
    cast: ['John Travolta', 'Samuel L. Jackson', 'Uma Thurman', 'Bruce Willis'] },
  { title: 'Kill Bill: Vol. 1', year: 2003, directors: ['Quentin Tarantino'], genres: ['Action', 'Crime', 'Thriller'],
    cast: ['Uma Thurman', 'David Carradine', 'Lucy Liu', 'Michael Madsen'] },
  { title: 'Django Unchained', year: 2012, directors: ['Quentin Tarantino'], genres: ['Western', 'Drama', 'Action'],
    cast: ['Jamie Foxx', 'Christoph Waltz', 'Leonardo DiCaprio', 'Samuel L. Jackson'] },
  { title: 'Inglourious Basterds', year: 2009, directors: ['Quentin Tarantino'], genres: ['War', 'Drama', 'Action'],
    cast: ['Brad Pitt', 'Christoph Waltz', 'Michael Fassbender', 'Diane Kruger'] },

  // --- Ridley Scott ---
  { title: 'Gladiator', year: 2000, directors: ['Ridley Scott'], genres: ['Action', 'Drama', 'Adventure'],
    cast: ['Russell Crowe', 'Joaquin Phoenix', 'Connie Nielsen'] },
  { title: 'Alien', year: 1979, directors: ['Ridley Scott'], genres: ['Sci-Fi', 'Horror', 'Thriller'],
    cast: ['Sigourney Weaver', 'Tom Skerritt', 'John Hurt'] },
  { title: 'Blade Runner', year: 1982, directors: ['Ridley Scott'], genres: ['Sci-Fi', 'Thriller', 'Drama'],
    cast: ['Harrison Ford', 'Rutger Hauer', 'Sean Young'] },
  { title: 'The Martian', year: 2015, directors: ['Ridley Scott'], genres: ['Sci-Fi', 'Adventure', 'Drama'],
    cast: ['Matt Damon', 'Jessica Chastain', 'Jeff Daniels'] },

  // --- Peter Jackson ---
  { title: 'The Fellowship of the Ring', year: 2001, directors: ['Peter Jackson'], genres: ['Fantasy', 'Adventure', 'Drama'],
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen', 'Sean Astin'] },
  { title: 'The Two Towers', year: 2002, directors: ['Peter Jackson'], genres: ['Fantasy', 'Adventure', 'Drama'],
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen', 'Sean Astin'] },
  { title: 'The Return of the King', year: 2003, directors: ['Peter Jackson'], genres: ['Fantasy', 'Adventure', 'Drama'],
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen', 'Sean Astin'] },

  // --- David Fincher ---
  { title: 'Fight Club', year: 1999, directors: ['David Fincher'], genres: ['Drama', 'Thriller'],
    cast: ['Brad Pitt', 'Edward Norton', 'Helena Bonham Carter'] },
  { title: 'Se7en', year: 1995, directors: ['David Fincher'], genres: ['Crime', 'Mystery', 'Thriller'],
    cast: ['Brad Pitt', 'Morgan Freeman', 'Kevin Spacey', 'Gwyneth Paltrow'] },
  { title: 'The Social Network', year: 2010, directors: ['David Fincher'], genres: ['Drama', 'Biography'],
    cast: ['Jesse Eisenberg', 'Andrew Garfield', 'Justin Timberlake', 'Armie Hammer'] },

  // --- Denis Villeneuve ---
  { title: 'Dune', year: 2021, directors: ['Denis Villeneuve'], genres: ['Sci-Fi', 'Adventure', 'Drama'],
    cast: ['Timothee Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Oscar Isaac'] },
  { title: 'Arrival', year: 2016, directors: ['Denis Villeneuve'], genres: ['Sci-Fi', 'Drama', 'Mystery'],
    cast: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'] },
  { title: 'Blade Runner 2049', year: 2017, directors: ['Denis Villeneuve'], genres: ['Sci-Fi', 'Thriller', 'Drama'],
    cast: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas'] },

  // --- Francis Ford Coppola ---
  { title: 'The Godfather', year: 1972, directors: ['Francis Ford Coppola'], genres: ['Crime', 'Drama'],
    cast: ['Marlon Brando', 'Al Pacino', 'James Caan', 'Robert Duvall'] },
  { title: 'The Godfather Part II', year: 1974, directors: ['Francis Ford Coppola'], genres: ['Crime', 'Drama'],
    cast: ['Al Pacino', 'Robert De Niro', 'Robert Duvall', 'Diane Keaton'] },
  { title: 'Apocalypse Now', year: 1979, directors: ['Francis Ford Coppola'], genres: ['War', 'Drama'],
    cast: ['Marlon Brando', 'Martin Sheen', 'Robert Duvall'] }
];

module.exports = { movies };
