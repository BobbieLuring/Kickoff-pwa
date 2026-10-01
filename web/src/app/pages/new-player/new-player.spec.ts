import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NewPlayer } from './new-player';

describe('NewPlayer', () => {
  let component: NewPlayer;
  let fixture: ComponentFixture<NewPlayer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewPlayer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NewPlayer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
