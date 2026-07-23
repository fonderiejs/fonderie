import express from 'express';
import { mount } from '@fonderie/adapter-express';
import { fonderie } from './fonderie';

const app = mount(express(), fonderie);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log('LISTENING ' + port));
