import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WhoAnswered } from './who-answered';

describe('WhoAnswered', () => {
  let component: WhoAnswered;
  let fixture: ComponentFixture<WhoAnswered>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhoAnswered],
    }).compileComponents();

    fixture = TestBed.createComponent(WhoAnswered);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
