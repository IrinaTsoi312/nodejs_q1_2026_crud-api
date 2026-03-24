# nodejs_q1_2026_crud-api

## INSTALLATION

- Clone repository using SSH or HTTPS link, copied from 'Code' button's modal;
- open directory (folder) with the project;
- run command `git checkout develop` to shift to the task branch with the code for review;
- run command `npm install` to install all dependencies.

## CRUD API cross-chek

For the purpose of cross-shecking, it is recommended to use apps, designed to test REST api requests, such as Postman, Thunder Client or Testfully. Postman and thunder client copuld be installed as an extension to your code editor, Testfully app is only working as a desktop app. It is also possible to use other convient for your use tools.

### To check 500 Internal Server Error, you could use any request, sending JSON object to the server, and try to use invalid JSON object inside of the body and send it with request. For example, put JSON object with missing bracket into the body of PUT request. 
### You also could try to run GET request to http://localhost:4000/error, that will imitate server error